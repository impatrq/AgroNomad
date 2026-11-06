// src/hooks/useAnimalDashboard.js
import { useEffect, useRef, useState } from 'react'
import { apiUrl, getAnimalsWsUrl} from '../lib/api'
import {
  ANIMAL_MOVEMENT_THRESHOLD_METERS,
  ANIMAL_REST_DELAY_MS,
  getLocalDateKey,
  hasValidAnimalPosition,
  normalizeBoundaryGroups,
} from '../lib/utils'

const MAX_ANIMAL_SPEED_METERS_PER_SECOND = 15
const MAX_POSITION_GAP_FOR_DISTANCE_MS = 60_000

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const latitudeDifference = toRadians(lat2 - lat1)
  const longitudeDifference = toRadians(lng2 - lng1)
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(longitudeDifference / 2) ** 2

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function getStoredDailyDistance(animalId, dateKey) {
  try {
    const stored = window.localStorage.getItem(`agronomad:distance:${animalId}:${dateKey}`)
    const distance = Number(stored)
    return Number.isFinite(distance) && distance >= 0 ? distance : 0
  } catch (error) {
    console.error('Could not read the daily animal distance:', error)
    return 0
  }
}

function storeDailyDistance(animalId, dateKey, distance) {
  try {
    window.localStorage.setItem(
      `agronomad:distance:${animalId}:${dateKey}`,
      String(distance),
    )
  } catch (error) {
    console.error('Could not save the daily animal distance:', error)
  }
}

function updateAnimalActivity(activityByAnimal, animal, timestamp) {
  const dateKey = getLocalDateKey(timestamp)
  const previous = activityByAnimal.get(animal.id)

  if (!animal.hasPosition) {
    const activity = previous ?? {
      dateKey,
      distanceTodayMeters: getStoredDailyDistance(animal.id, dateKey),
      quietSince: null,
      movementStartedAt: null,
      lastMovementAt: null,
    }
    const currentActivity = activity.dateKey === dateKey
      ? activity
      : {
          ...activity,
          dateKey,
          distanceTodayMeters: getStoredDailyDistance(animal.id, dateKey),
        }
    activityByAnimal.set(animal.id, currentActivity)
    return currentActivity
  }

  if (
    !previous ||
    !Number.isFinite(previous.anchorLat) ||
    !Number.isFinite(previous.anchorLng)
  ) {
    const initialActivity = {
      ...previous,
      anchorLat: animal.lat,
      anchorLng: animal.lng,
      anchorUpdatedAt: timestamp,
      dateKey,
      distanceTodayMeters: previous?.dateKey === dateKey
        ? previous.distanceTodayMeters
        : getStoredDailyDistance(animal.id, dateKey),
      quietSince: previous?.quietSince ?? timestamp,
      movementStartedAt: previous?.movementStartedAt ?? null,
      lastMovementAt: previous?.lastMovementAt ?? null,
    }
    activityByAnimal.set(animal.id, initialActivity)
    return initialActivity
  }

  if (previous.dateKey !== dateKey) {
    const updatedActivity = {
      ...previous,
      anchorLat: animal.lat,
      anchorLng: animal.lng,
      anchorUpdatedAt: timestamp,
      dateKey,
      distanceTodayMeters: getStoredDailyDistance(animal.id, dateKey),
    }
    activityByAnimal.set(animal.id, updatedActivity)
    return updatedActivity
  }

  const movedDistance = getDistanceMeters(
    previous.anchorLat,
    previous.anchorLng,
    animal.lat,
    animal.lng,
  )
  if (movedDistance >= ANIMAL_MOVEMENT_THRESHOLD_METERS) {
    const elapsedMs = Math.max(timestamp - previous.anchorUpdatedAt, 0)
    const plausibleDistance =
      MAX_ANIMAL_SPEED_METERS_PER_SECOND *
        (Math.min(elapsedMs, MAX_POSITION_GAP_FOR_DISTANCE_MS) / 1000) +
      ANIMAL_MOVEMENT_THRESHOLD_METERS
    if (movedDistance > plausibleDistance) {
      console.warn(
        `[Telemetry] Ignoring implausible GPS jump for ${animal.id}: ` +
          `${Math.round(movedDistance)} m in ${Math.round(elapsedMs / 1000)} s`,
      )
      return previous
    }

    const movementContinues =
      previous.lastMovementAt !== null &&
      timestamp - previous.lastMovementAt < ANIMAL_REST_DELAY_MS
    const updatedActivity = {
      anchorLat: animal.lat,
      anchorLng: animal.lng,
      anchorUpdatedAt: timestamp,
      dateKey,
      distanceTodayMeters: previous.distanceTodayMeters + movedDistance,
      quietSince: null,
      movementStartedAt: movementContinues ? previous.movementStartedAt : timestamp,
      lastMovementAt: timestamp,
    }
    activityByAnimal.set(animal.id, updatedActivity)
    storeDailyDistance(animal.id, dateKey, updatedActivity.distanceTodayMeters)
    return updatedActivity
  }

  return previous
}

// Derive ws:// or wss:// from your apiUrl so it works in dev & prod 
// For example in dev ==> ws://localhost:3000/ws/animals


export default function useAnimalDashboard() {
  const [animals, setAnimals] = useState([])
  const [yardBoundaries, setYardBoundaries] = useState([])
  const [selectedAnimal, setSelectedAnimal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const selectedAnimalRef = useRef(null)
  const missingPositionIdsRef = useRef(new Set())
  const animalActivityRef = useRef(new Map())

  useEffect(() => {
    selectedAnimalRef.current = selectedAnimal
  }, [selectedAnimal])

  // ---------- Yards: still a one-shot fetch (unchanged) ----------
  useEffect(() => {
    let isMounted = true

    async function loadYards() {
      try {
        const yardsResponse = await fetch(apiUrl('/api/yards'))
        if (!yardsResponse.ok) {
          throw new Error(`Yards: ${yardsResponse.status} ${yardsResponse.statusText}`)
        }
        const yardsData = await yardsResponse.json()
        if (!isMounted) return
        setYardBoundaries(normalizeBoundaryGroups(yardsData))
      } catch (err) {
        if (!isMounted) return
        console.error('Yards load error:', err)
        setError((prev) => prev ?? (err.message || 'No se pudo cargar los yards.'))
      }
    }

    loadYards()
    return () => {
      isMounted = false
    }
  }, [])

  // ---------- Animals: live via WebSocket ----------

  useEffect(() => {

    let isMounted = true

    const applyAnimals = (rawAnimals) => {
      
      if (!isMounted) return

      if (!Array.isArray(rawAnimals)) {
        setError('Invalid animals data format')
        setLoading(false)
        return
      }

      const timestamp = Date.now()
      const normalized = rawAnimals.map((item) => {
        const lat = Number(item.lat ?? 0)
        const lng = Number(item.lng ?? 0)

        const animal = {
          id: String(item.id ?? ''),
          name: item.name ?? `Animal ${item.id ?? ''}`,
          lat,
          lng,
          hasPosition: item.hasPosition !== false && hasValidAnimalPosition({ lat, lng }),
          temp: String(item.temp ?? ''),
        }

        return {
          ...animal,
          ...updateAnimalActivity(animalActivityRef.current, animal, timestamp),
        }
      })

      const missingPositionAnimals = normalized.filter((animal) => !animal.hasPosition)
      const newlyMissingPositionAnimals = missingPositionAnimals.filter(
        (animal) => !missingPositionIdsRef.current.has(animal.id)
      )
      if (newlyMissingPositionAnimals.length > 0) {
        console.warn(
          '[Telemetry] Data received without position data for:',
          newlyMissingPositionAnimals.map((animal) => animal.id)
        )
      }
      missingPositionIdsRef.current = new Set(missingPositionAnimals.map((animal) => animal.id))

      const previouslySelectedId = selectedAnimalRef.current?.id

      setAnimals(normalized)

      if (normalized.length > 0) {
        const firstWithPosition = normalized.find(hasValidAnimalPosition)
        const updatedSelection = normalized.find((animal) => animal.id === previouslySelectedId)
        setSelectedAnimal(updatedSelection || firstWithPosition || normalized[0])
      } else {
        setSelectedAnimal(null)
      }

      setLoading(false)
      setError(null)
    }

    async function loadAnimals(){
      setLoading(true)
      setError(null)

      if (!isMounted) return

      const socket = new WebSocket(getAnimalsWsUrl());

      socket.onopen = () => {
        console.log("Connected to server");
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

         const rawAnimals = Array.isArray(data)
          ? data
          : Array.isArray(data?.animals)
            ? data.animals
            : []
        
        applyAnimals(rawAnimals)
        /*
        if (msg?.type === 'animals' || msg?.type === 'update') {
          console.log("triny");
          applyAnimals(msg.data ?? msg.animals)
        } else if (msg?.type === 'error') {
          console.log("error");
          setError(msg.message || 'Server error')
        }*/
        //setCow(data);
        console.log(data);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      socket.onclose = () => {
        console.log("Disconnected");
      };

      // Important: close socket when component unmounts
      return () => {
        socket.close();
      };
    }
    loadAnimals()
  }, []);
  
  /*
  useEffect(() => {
    let isMounted = true
    let ws = null
    let retry = 0
    let retryTimer = null
    let closedByUser = false

    const applyAnimals = (rawAnimals) => {
      if (!isMounted) return

      if (!Array.isArray(rawAnimals)) {
        setError('Invalid animals data format')
        setLoading(false)
        return
      }

      const normalized = rawAnimals.map((item) => ({
        id: String(item.id ?? ''),
        name: item.name ?? `Animal ${item.id ?? ''}`,
        lat: Number(item.lat ?? 0),
        lng: Number(item.lng ?? 0),
        temp: String(item.temp ?? ''),
      }))

      const previouslySelectedId = selectedAnimalRef.current?.id

      setAnimals(normalized)

      if (normalized.length > 0) {
        const stillSelected = normalized.find((a) => a.id === previouslySelectedId)
        setSelectedAnimal(stillSelected || normalized[0])
      } else {
        setSelectedAnimal(null)
      }

      setLoading(false)
      setError(null)
    }

    const scheduleReconnect = () => {
      clearTimeout(retryTimer)
      // exponential backoff with jitter, capped at 30s
      const delay = Math.min(1000 * 2 ** retry, 30000) + Math.random() * 300
      retry += 1
      retryTimer = setTimeout(connect, delay)
    }

    const connect = () => {
      if (closedByUser || !isMounted) return

      try {
        ws = new WebSocket(getAnimalsWsUrl())
      } catch (err) {
        console.error('WS create failed:', err)
        scheduleReconnect()
        return
      }

      ws.onopen = () => {
        retry = 0
      }

      ws.onmessage = (ev) => {
        let msg
        try {
          msg = JSON.parse(ev.data)
        } catch {
          return
        }

        if (msg?.type === 'animals' || msg?.type === 'update') {
          applyAnimals(msg.data ?? msg.animals)
        } else if (msg?.type === 'error') {
          setError(msg.message || 'Server error')
        }
      }

      ws.onclose = () => {
        if (!closedByUser && isMounted) scheduleReconnect()
      }

      ws.onerror = () => {
        // onclose will fire right after; let it handle the retry
        try { ws?.close() } catch {}
      }
    }

    connect()

    return () => {
      isMounted = false
      closedByUser = true
      clearTimeout(retryTimer)
      try { ws?.close() } catch {}
    }
  }, [])

  */

  // ---------- Rename: unchanged ----------
  const handleRenameAnimal = async (newName) => {
    if (!selectedAnimal) {
      throw new Error('No hay un animal seleccionado.')
    }

    const response = await fetch(apiUrl('/api/animals/rename'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedAnimal.id, name: newName }),
    })

    if (!response.ok) {
      throw new Error('No se pudo actualizar el nombre en el servidor.')
    }

    const result = await response.json().catch(() => ({}))
    if (result?.status !== 'ok') {
      throw new Error('El servidor no confirmó el cambio.')
    }

    setAnimals((prevAnimals) =>
      prevAnimals.map((animal) =>
        animal.id === selectedAnimal.id ? { ...animal, name: newName } : animal
      )
    )

    setSelectedAnimal((prevSelected) =>
      prevSelected && prevSelected.id === selectedAnimal.id
        ? { ...prevSelected, name: newName }
        : prevSelected
    )
  }

  return {
    animals,
    yardBoundaries,
    selectedAnimal,
    setSelectedAnimal,
    loading,
    error,
    handleRenameAnimal,
  }
}