import { useMemo, useState } from 'react'
import RenameAnimalModal from '../components/RenameAnimalModal'
import TopNav from '../components/home/TopNav'
import MapSection from '../components/home/MapSection'
import OverviewPanel from '../components/home/OverviewPanel'
import AnimalDetailsPanel from '../components/home/AnimalDetailsPanel'
import useAnimalDashboard from '../hooks/useAnimalDashboard'

export default function Home({ onNavigate }) {
  const {
    animals,
    yardBoundaries,
    selectedAnimal,
    setSelectedAnimal,
    loading,
    error,
    handleRenameAnimal,
  } = useAnimalDashboard()

  const [menuOpen, setMenuOpen] = useState(false)
  const [renameModalOpen, setRenameModalOpen] = useState(false)

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMenuOpen(false)
  }

  const mapPosition = useMemo(() => {
    if (selectedAnimal?.lat && selectedAnimal?.lng) {
      return [selectedAnimal.lat, selectedAnimal.lng]
    }
    if (animals.length > 0) {
      return [animals[0].lat, animals[0].lng]
    }
    return [-34.71, -58.24]
  }, [selectedAnimal, animals])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopNav
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((prev) => !prev)}
        onNavigate={onNavigate}
        scrollToSection={scrollToSection}
      />

      <section className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <MapSection
            animals={animals}
            selectedAnimal={selectedAnimal}
            onSelectAnimal={setSelectedAnimal}
            yardBoundaries={yardBoundaries}
            mapPosition={mapPosition}
            loading={loading}
            error={error}
          />

          <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
            <OverviewPanel animals={animals} loading={loading} error={error} />
            <AnimalDetailsPanel
              selectedAnimal={selectedAnimal}
              onNavigate={onNavigate}
              onRenameRequest={() => setRenameModalOpen(true)}
            />
          </div>
        </div>
      </section>

      <RenameAnimalModal
        animal={selectedAnimal}
        isOpen={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        onConfirm={handleRenameAnimal}
      />
    </div>
  )
}
