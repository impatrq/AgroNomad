import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { MapPin, HeartPulse, Thermometer, Cpu, Radio, Battery } from "lucide-react";

import logoIg from "@/assets/logos/Logo_instagram.png";
import imgc1s1 from "@/assets/agronomad/Presentation1/NomadC1S1.jpeg";
import imgc1s2 from "@/assets/agronomad/Presentation1/NomadC1S2.jpeg";
import imgc1s3 from "@/assets/agronomad/Presentation1/NomadC1S3.jpeg";
import imgc1s4 from "@/assets/agronomad/Presentation1/NomadC1S4.jpeg";
import imgc2s1 from "@/assets/agronomad/Presentation2/NomadC2S1.jpeg";
import imgc2s2 from "@/assets/agronomad/Presentation2/NomadC2S2.jpeg";
import imgc2s3 from "@/assets/agronomad/Presentation2/NomadC2S3.jpeg";
import imgc2s4 from "@/assets/agronomad/Presentation2/NomadC2S4.jpeg";

export default function AgroNomadLanding() {
  const imagesc1 = [imgc1s1, imgc1s2, imgc1s3, imgc1s4];
  const imagesc2 = [imgc2s1, imgc2s2, imgc2s3, imgc2s4]
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % imagesc1.length);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* NAVBAR */}
      <header className="w-full border-b sticky top-0 bg-white/80 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center p-4">
          <div className="flex column items-center space-x-2">
            <img src="/logo.jpeg" alt="Logo" className="w-12 h-12 rounded-full"/>
            <h1 className="text-2xl font-bold">
              <span className="text-light-green">Agro</span>
              <span className="text-light-orange">Nomad</span>
            </h1>
          </div>
          
          <nav className="space-x-6 hidden md:block">
            <a href="#about" className="hover:text-gray-600">Acerca de</a>
            <a href="#how" className="hover:text-gray-600">Como funciona</a>
            <a href="#features" className="hover:text-gray-600">Prestaciones</a>
            <a href="#tech" className="hover:text-gray-600">Tecnologia</a>
            <a href="#contact" className="hover:text-gray-600">Contacto</a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-5xl font-bold leading-tight mb-6">
              Monitoreo inteligente de ganado con AgroNomad
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Un sistema diseñado para el ganado bovino con el fin de rastrear la ubicación y monitorear datos de salud
              vitales como la frecuencia cardíaca y la temperatura corporal en tiempo real.
            </p>
            <Button className="text-lg px-6 py-6"
            onClick={() => {
              document.getElementById("how").scrollIntoView({behavior:"smooth"});
            }}
            >Ver cómo funciona</Button>
          </div>
          <div className="bg-gray-100 rounded-2xl h-[400px] relative overflow-hidden">
            {imagesc1.map((img, i) => (
              <img key={i} src={img} alt={`Presentation ${i+1}`} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === current ? 'opacity-100' : 'opacity-0'}`} />
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-6">Acerca del proyecto</h3>
          <p className="text-gray-600 text-lg">
            Agronomad es un sistema de monitoreo inteligente diseñado con el fin de brindar al sector ganadero una
            herramienta que permita rastrear y monitorear indicadores de salud del ganado. El collar recopila datos
            en tiempo real y los envía a una estación de recepción, donde son procesados y subidos a una interfaz web para un
            análisis fácil y una toma de decisiones informada.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">Como funciona</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="rounded-2xl">
              <CardContent className="p-6 text-center">
                <Radio className="mx-auto mb-4" size={40} />
                <h4 className="font-semibold text-lg mb-2">Collar Inteligente</h4>
                <p className="text-gray-600">Se coloca en el ganado para recopilar y enviar de forma inalámbrica los datos de salud y ubicación.</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-6 text-center">
                <Cpu className="mx-auto mb-4" size={40} />
                <h4 className="font-semibold text-lg mb-2">Estación de Recepción</h4>
                <p className="text-gray-600">Recibe y procesa los registros enviados por los collares. A su vez, genera la interfaz de usuario.</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-6 text-center">
                <MapPin className="mx-auto mb-4" size={40} />
                <h4 className="font-semibold text-lg mb-2">Interfaz de Usuario</h4>
                <p className="text-gray-600">La información procesada puede verse reflejada en tiempo real.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">Prestaciones</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <Feature icon={<MapPin />} title="Seguimiento GPS" />
            <Feature icon={<HeartPulse />} title="Monitoreo de Frecuencia Cardíaca" />
            <Feature icon={<Thermometer />} title="Monitoreo de Temperatura" />
            <Feature icon={<Battery />} title="Bajo Consumo de Energía" />
            <Feature icon={<Radio />} title="Comunicación Inalámbrica" />
            <Feature icon={<Cpu />} title="Procesamiento Inteligente" />
          </div>
        </div>
      </section>

      {/* TECHNOLOGY */}
      <section id="tech" className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-6">Tecnología utilizada</h3>
          <ul className="text-gray-600 space-y-2">
            <li>Microcontrolador ESP32</li>
            <li>Módulo GPS</li>
            <li>Sensores de movimiento, temperatura y frecuencia cardíaca</li>
            <li>Comunicación inalámbrica (LoRa / GSM / WiFi)</li>
            <li>Interfaz de monitoreo web y física</li>
          </ul>
        </div>
        <div className="bg-gray-100 rounded-2xl h-[400px] w-[400px] relative overflow-hidden mx-auto">
            {imagesc2.map((img, i) => (
              <img key={i} src={img} alt={`Presentation ${i+1}`} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === current ? 'opacity-100' : 'opacity-0'}`} />
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-6">Contacto</h3>
          <p className="text-gray-600 mb-2">E.E.S.T N.7 ("T.R.Q"), Quilmes, Buenos Aires</p>
          <p className="text-gray-600 mb-2">nomadbusiness2026@gmail.com</p>
            <a className="flex items-center justify-center space-x-1 w-fit mx-auto" href="https://www.instagram.com/proyecto.agronomad" target="_blank" rel="noopener noreferrer">
              <img src={logoIg} alt="Instagram" className="w-6 h-6" />
              <p className="text-gray-600">@proyecto.agronomad</p>
            </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 text-center border-t">
        <p className="text-gray-500">© 2026 AgroNomad - Monitoreo Inteligente de Ganado</p>
      </footer>
    </div>
  );
}

function Feature({ icon, title }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6 text-center">
        <div className="mx-auto mb-4">{icon}</div>
        <h4 className="font-semibold text-lg">{title}</h4>
      </CardContent>
    </Card>
  );
}