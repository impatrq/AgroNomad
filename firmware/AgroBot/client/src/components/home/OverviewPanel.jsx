import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  HeartPulse,
  MapPin,
  Thermometer,
  TrendingUp,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                  DATA                                      */
/* -------------------------------------------------------------------------- */

const activityData = [
  { time: "00", value: 18 },
  { time: "02", value: 22 },
  { time: "04", value: 15 },
  { time: "06", value: 28 },
  { time: "08", value: 48 },
  { time: "10", value: 65 },
  { time: "12", value: 58 },
  { time: "14", value: 72 },
  { time: "16", value: 81 },
  { time: "18", value: 68 },
  { time: "20", value: 52 },
  { time: "22", value: 34 },
  { time: "24", value: 24 },
];

const metrics = [
  {
    label: "Distancia recorrida",
    value: "12.4 km",
    icon: TrendingUp,
  },
  {
    label: "Tiempo en movimiento",
    value: "3h 42m",
    icon: Activity,
  },
  {
    label: "Tiempo de reposo",
    value: "8h 15m",
    icon: Clock3,
  },
  {
    label: "Temperatura promedio",
    value: "38.4 °C",
    icon: Thermometer,
  },
];

const recentActivity = [
  {
    animal: "Lora",
    message: "Temperatura elevada",
    time: "Hace 8 min",
    type: "warning",
  },
  {
    animal: "Lola",
    message: "Ingresó al potrero",
    time: "Hace 21 min",
    type: "success",
  },
  {
    animal: "Toro 03",
    message: "Movimiento normal",
    time: "Hace 32 min",
    type: "success",
  },
];





/* -------------------------------------------------------------------------- */
/*                              ACTIVITY CHART                                */
/* -------------------------------------------------------------------------- */

function ActivityChart() {
  const width = 800;
  const height = 220;

  const points = activityData
    .map((point, index) => {
      const x = (index / (activityData.length - 1)) * width;
      const y = height - (point.value / 100) * height;

      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <div className="rounded-3xl bg-[#f0f4f7] p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Actividad del rodeo
          </p>

          <h3 className="mt-1 text-lg font-semibold text-[#0f2340]">
            Últimas 24 horas
          </h3>
        </div>

        <select
          className="rounded-xl border-none bg-white px-3 py-2 text-sm
                     text-slate-600 outline-none ring-0"
          defaultValue="24h"
        >
          <option value="24h">Últimas 24 horas</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
        </select>
      </div>

      <div className="overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height + 35}`}
          className="h-auto w-full"
          preserveAspectRatio="none"
        >
          {/* Horizontal grid */}
          {[0, 25, 50, 75, 100].map((value) => {
            const y = height - (value / 100) * height;

            return (
              <line
                key={value}
                x1="0"
                y1={y}
                x2={width}
                y2={y}
                stroke="#d9e1e7"
                strokeWidth="1"
              />
            );
          })}

          {/* Area */}
          <polygon
            points={areaPoints}
            fill="#009f70"
            opacity="0.08"
          />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke="#009f70"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X axis labels */}
          {activityData.map((point, index) => {
            const x = (index / (activityData.length - 1)) * width;

            return (
              <text
                key={point.time}
                x={x}
                y={height + 25}
                textAnchor="middle"
                className="fill-slate-400 text-[11px]"
              >
                {point.time}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              METRICS GRID                                  */
/* -------------------------------------------------------------------------- */

function MetricsGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="rounded-2xl bg-[#f0f4f7] p-4 transition
                     duration-200 hover:-translate-y-0.5 hover:shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
              {label}
            </span>

            <Icon className="h-4 w-4 text-[#009f70]" strokeWidth={2} />
          </div>

          <p className="text-xl font-bold text-[#0f2340]">
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            HERD STATUS                                     */
/* -------------------------------------------------------------------------- */

function HerdStatus() {
  return (
    <div className="rounded-2xl bg-[#f0f4f7] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Estado del rodeo
          </p>

          <h3 className="mt-1 text-lg font-semibold text-[#0f2340]">
            Monitoreo actual
          </h3>
        </div>

        <HeartPulse className="h-5 w-5 text-[#009f70]" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatusItem
          icon={CheckCircle2}
          value="3"
          label="Normales"
          iconClass="text-emerald-500"
        />

        <StatusItem
          icon={AlertTriangle}
          value="1"
          label="Atención"
          iconClass="text-orange-500"
        />

        <StatusItem
          icon={AlertTriangle}
          value="0"
          label="Críticos"
          iconClass="text-red-500"
        />
      </div>
    </div>
  );
}

function StatusItem({ icon: Icon, value, label, iconClass }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <Icon className={`mb-2 h-5 w-5 ${iconClass}`} />

      <p className="text-xl font-bold text-[#0f2340]">
        {value}
      </p>

      <p className="text-xs text-slate-500">
        {label}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                           RECENT ACTIVITY                                  */
/* -------------------------------------------------------------------------- */

function RecentActivity() {
  return (
    <div className="rounded-2xl bg-[#f0f4f7] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Actividad reciente
          </p>

          <h3 className="mt-1 text-lg font-semibold text-[#0f2340]">
            Últimos eventos
          </h3>
        </div>

        <MapPin className="h-5 w-5 text-[#009f70]" />
      </div>

      <div className="space-y-3">
        {recentActivity.map((event) => (
          <ActivityItem
            key={`${event.animal}-${event.time}`}
            {...event}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityItem({ animal, message, time, type }) {
  const isWarning = type === "warning";

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          isWarning ? "bg-orange-100" : "bg-emerald-100"
        }`}
      >
        {isWarning ? (
          <AlertTriangle className="h-4 w-4 text-orange-500" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[#0f2340]">
            {animal}
          </p>

          <span className="text-xs text-slate-400">
            {time}
          </span>
        </div>

        <p className="truncate text-sm text-slate-500">
          {message}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            MAIN COMPONENT                                  */
/* -------------------------------------------------------------------------- */

function OverviewPanel2() {
  return (
    <section className="rounded-[28px] border border-[#c7eadf] bg-white p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#0f2340]">
          Visión general
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Resumen del estado y actividad de tu rodeo
        </p>
      </div>

      {/* Top stats */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <OverviewCard
          label="Total de animales"
          value="4"
        />

        <OverviewCard
          label="Estado"
          value="OK"
          valueClass="text-emerald-600"
        />
      </div>

      {/* Activity chart */}
      <div className="mb-5">
        <ActivityChart />
      </div>

      {/* Metrics */}
      <div className="mb-5">
        <MetricsGrid />
      </div>

      {/* Bottom panels */}
      <div className="grid gap-5 lg:grid-cols-2">
        <HerdStatus />
        <RecentActivity />
      </div>

      {/* Last update */}
      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-400">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Última actualización hace 18 segundos
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                              OVERVIEW CARD                                 */
/* -------------------------------------------------------------------------- */

function OverviewCard({
  label,
  value,
  valueClass = "text-[#0f2340]",
}) {
  return (
    <div className="rounded-3xl bg-[#f0f4f7] p-6">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className={`mt-3 text-xl font-bold ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}



export default function OverviewPanel({ animals, loading, error }) {
  return (
    <div id="overview-section" className="h-full rounded-[28px] border border-green-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold">Visión general</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl bg-slate-100 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Total de animales</p>
          <p className="mt-2 text-1xl font-semibold text-slate-900">{animals.length}</p>
        </div>
        <div className="rounded-3xl bg-slate-100 p-5">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Estado</p>
          <p className="mt-2 text-1xl font-semibold text-slate-900">{error ? 'Error' : loading ? 'Cargando' : 'OK'}</p>
        </div>
      </div>
      {/* Activity chart */}
      <div className="mt-5 mb-5">
        <ActivityChart />
      </div>

      {/* Metrics */}
      <div className="mb-5">
        <MetricsGrid />
      </div>
    </div>
  )
}
