import HeaderMain from "../components/HeaderMain"

export default function YardsConfig({ onNavigate }){
    return(
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <HeaderMain subtitle={"Información de campos."} onNavigate={onNavigate}/>
        </div>
    )
}