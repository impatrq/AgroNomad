import { useState } from "react";

export default function Login({ onNavigate, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Make POST request to send login form.
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
        return;
      }

      // Login successful
      onLogin && onLogin(data.user);
    } catch (err) {
      setError("Unable to connect to server");
    }
  }

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8 bg-gradient-to-b from-emerald-900/30 to-transparent">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
        <img alt="LOGO" src="./logo.jpeg" className="mx-auto h-20 w-20 rounded-full object-cover" />
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">AgroNomad</h2>
        <p className="mt-2 text-lg text-white/80">Bienvenido</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="bg-white/5 backdrop-blur rounded-lg px-6 py-8 shadow-lg">
          {error && (
            <div className="mb-4 rounded-md bg-red-700/60 text-red-100 px-4 py-2 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white">
                Correo electrónico
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md bg-white/6 px-3 py-2 text-base text-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-white">
                  Contraseña
                </label>

                <div className="text-sm">
                  <a href="#" className="font-semibold text-emerald-300 hover:text-emerald-200">
                    Olvidaste tu contraseña?
                  </a>
                </div>
              </div>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md bg-white/6 px-3 py-2 text-base text-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                Continuar
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-gray-300">
            No tienes cuenta?{' '}
            <a href="#" className="font-semibold text-emerald-300 hover:text-emerald-200">Contactate con AgroNomad</a>
          </p>
        </div>
      </div>
    </div>
  );
}