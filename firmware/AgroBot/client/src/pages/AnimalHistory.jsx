import Sidebar from '../components/animalhistory/Sidebar'
import Header from '../components/animalhistory/Header'
import FilterBar from '../components/animalhistory/FilterBar'
import AnimalTable from '../components/animalhistory/AnimalTable'
import DetailsPanel from '../components/animalhistory/DetailsPanel'



export default function AnimalHistory({ onNavigate }){

    // --- DUMMY DATA ---
    // Array representing the animals in the table
    const animalsData = [
    { id: 1, name: 'Lora', collar: 'COLLAR-01', type: 'Vaca', age: '3 años', yard: 'Campo Norte', lastSeen: 'Hace 2 h', status: 'Activa' },
    { id: 2, name: 'Lola', collar: 'COLLAR-02', type: 'Vaca', age: '4 años', yard: 'Campo Norte', lastSeen: 'Hace 3 h', status: 'Activa' },
    { id: 3, name: 'Bruno', collar: 'COLLAR-03', type: 'Toro', age: '5 años', yard: 'Pastura Este', lastSeen: 'Hace 5 h', status: 'Activo' },
    { id: 4, name: 'Nina', collar: 'COLLAR-04', type: 'Vaca', age: '2 años', yard: 'Campo Sur', lastSeen: 'Hace 6 h', status: 'Activa' },
    { id: 5, name: 'Toby', collar: 'COLLAR-05', type: 'Vaca', age: '3 años', yard: 'Campo Norte', lastSeen: 'Hace 8 h', status: 'Activa' },
    { id: 6, name: 'Marta', collar: 'COLLAR-06', type: 'Vaquillona', age: '1 año', yard: 'Pastura Este', lastSeen: 'Hace 10 h', status: 'Activa' },
    { id: 7, name: 'Rocco', collar: 'COLLAR-07', type: 'Toro', age: '6 años', yard: 'Campo Sur', lastSeen: 'Hace 12 h', status: 'Activo' },
    { id: 8, name: 'Sombra', collar: 'COLLAR-08', type: 'Vaca', age: '4 años', yard: 'Campo Oeste', lastSeen: 'Hace 14 h', status: 'Activa' },
    ];

    return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* 1. Left Sidebar (Hidden on mobile) <Sidebar />*/}
      

      {/* 2. Main Content Area */}
      <main className="min-w-0">
        <Header onNavigate={onNavigate}/>
        
        {/* Content Padding Container */}
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          
          <FilterBar />
          
          {/* Grid Layout for Table and Details Panel */}
          {/* On small screens: stacked (flex-col) */}
          {/* On large screens: side by side (lg:flex-row) */}
          <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
            
            {/* Center: Animal Table */}
            <div className="flex min-w-0">
              <AnimalTable animalsData={animalsData}/>
            </div>
            
            {/* Right: Details Panel */}
            <DetailsPanel />
            
          </div>
        </div>
      </main>
    </div>
  );
}
