// src/hooks/useAnimalDashboard.js
import { useEffect, useRef, useState } from 'react'
import { apiUrl, getAnimalsWsUrl} from '../lib/api'
import { normalizeBoundaryGroups } from '../lib/utils'

// Derive ws:// or wss:// from your apiUrl so it works in dev & prod 
// For example in dev ==> ws://localhost:3000/ws/animals


export default function useAnimalDashboard() {
  const [animals, setAnimals] = useState([])
  const [yardBoundaries, setYardBoundaries] = useState([])
  const [selectedAnimal, setSelectedAnimal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const selectedAnimalRef = useRef(null)

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

    async function loadAnimals(){
      setLoading(true)
      setError(null)

      if (!isMounted) return

      const socket = new WebSocket("ws://localhost:4000/ws/animals");

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