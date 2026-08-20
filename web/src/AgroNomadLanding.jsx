import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DarkModeToggle from '@/components/ui/darkMode.jsx'

import { MapPin, SolarPanel, Thermometer, Radio, Cpu } from "lucide-react";

import logoIg from "@/assets/logos/Logo_instagram.png";
import logoTiktok from "@/assets/logos/Logo_tiktok.png";
import logoMaps from "@/assets/logos/Logo_maps.png";
import logoGmail from "@/assets/logos/Logo_gmail.png";
import cowField from "@/assets/agronomad/Images/cowfield.png";  
import greenField from "@/assets/agronomad/Images/greenField.jpg";
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
  const [currentHowCard, setCurrentHowCard] = useState(0);

  const howCards = [
    {
      icon: <Radio className="mx-auto mb-4" color="Blue" size={60} />,
      title: "Collar Inteligente",
      description: "Se coloca en el ganado para recopilar y enviar de forma inalámbrica los datos de salud y ubicación.",
    },
    {
      icon: <Cpu className="mx-auto mb-4" color="Green" size={60} />,
      title: "Estación de Recepción",
      description: "Recibe y procesa los registros enviados por los collares. A su vez, genera la interfaz de usuario.",
    },
    {
      icon: <MapPin className="mx-auto mb-4" color="Orange" size={60} />,
      title: "Interfaz de Usuario",
      description: "La información procesada puede verse reflejada en tiempo real. El usuario puede también interactuar con ella.",
    },
  ];

  const goToHowCard = (direction) => {
    setCurrentHowCard((prev) => (prev + direction + howCards.length) % howCards.length);
  };

  const getHowCardPosition = (index) => {
    const diff = (index - currentHowCard + howCards.length) % howCards.length;
    if (diff === 0) return 0;
    if (diff === 1) return 1;
    if (diff === howCards.length - 1) return -1;
    return diff > 1 ? 2 : -2;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % imagesc1.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [imagesc1.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHowCard((prev) => (prev + 1) % howCards.length);
    }, 2600);

    return () => clearInterval(interval);
  }, [howCards.length]);

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-black dark:text-white transform-gpu h-48 overflow-y-auto scrollbar-gutter-auto scrollbar-thumb-light-green scrollbar-track-black/0 scroll-smooth scroll-pt-20">
      {/* NAVBAR */}
      <header className="w-full border-b sticky top-0 bg-gray-100/85 backdrop-blur z-50 dark:bg-slate-950/85">
        <div className="w-full mx-auto flex justify-between items-center px-4">
          <div className="flex column items-center space-x-2 mr-2">
            <img src="/logo.jpeg" alt="Logo" className="h-12 min-w-12 rounded-full "/>
            <h1 className="font-bold block hidden text-lg md:text-xl lg:text-3xl md:block">
              <span className="text-light-green">Agro</span>
              <span className="text-light-orange">Nomad</span>
            </h1>
          </div>
          
          <nav className="space-x-2 overflow-x-auto md:flex text-nowrap items-center text-base md:space-x-6 md:block md:font-semibold md:text-lg lg:text-xl">
            <a href="#about" className="flex-nowrap py-8 px-4 hover:text-gray-600">Acerca de</a>
            <a href="#description" className="py-8 px-4 hover:text-gray-600">Descripción</a>
            <a href="#how" className="py-8 px-4 hover:text-gray-600">Funcionamiento</a>
            <a href="#features" className="py-8 px-4 hover:text-gray-600">Prestaciones</a>
            <a href="#tech" className="py-8 px-4 hover:text-gray-600">Tecnologia</a>
            <a href="#contact"   className="py-8 px-4 hover:text-gray-600">Contacto</a>
          </nav>

          <div className="w-1xl flex justify-end">
            <DarkModeToggle/>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="about" className="lg:scroll-mt-28">
        <div className="mx-auto items-center h-[calc(100lvh-80px)]">
          <div className="flex items-center justify-center bg-center bg-no-repeat bg-cover bg-gray-100 mask-y-from-97% mask-y-to-100% h-full w-full relative overflow-hidden"
            style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.67), rgba(0,0,0,0.67)), url(${cowField})` }}
          > 
            <div className="max-w-4xl px-6 sm:px-10 md:px-20 lg:px-20 text-center">
              <h2 className="sm:text-3xl md:text-6xl lg:text-6xl text-white font-bold leading-tight py-12">
                Monitoreo inteligente de ganado con AgroNomad
              </h2>
              <p className="sm:text-xl md:text-2xl lg:text-2xl text-white font-semibold mb-8 text-balance sm:pb-10 md:pb-30 lg:pb-30">
                Un sistema diseñado para el ganado bovino con el fin de rastrear la ubicación y monitorear datos de salud
                vitales como la frecuencia cardíaca y la temperatura corporal en tiempo real.
              </p>
              <Button className="mx-auto text-black bg-white sm:text-lg md:text-2xl lg:text-2xl sm:p-6 md:p-10 lg:p-10 font-semibold cursor-pointer text-center"
              onClick={() => {
                document.getElementById("how").scrollIntoView({behavior:"smooth"});
              }}
              >Ver cómo funciona</Button>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="description" className="py-5 px-2 md:py-30 md:px-20 h-[calc(100lvh-80px)] w-full bg-gray-50 dark:bg-gray-950 lg:scroll-mt-28">
        <div className="block md:grid grid-cols-2 gap-20 mx-auto justify-items-center text-center h-full w-full">
          <div className="md:mx-8 md:my-6">
            <h3 className="text-lg md:text-5xl font-bold mb-2 md:mb-20">Descripción del proyecto</h3>
            <p className="text-center font-light text-gray-600 text-sm md:text-3xl md:leading-12 dark:text-gray-50 ">
              AgroNomad es un sistema de monitoreo inteligente diseñado con el fin de brindar al sector ganadero una
              herramienta que permita rastrear y monitorear indicadores de salud del ganado.
            </p>
            <p className="text-center font-light text-gray-600 text-sm md:text-3xl md:leading-12 dark:text-gray-50">
              El collar recopila datos en tiempo real y los envía a una estación de recepción, donde son procesados y subidos a una interfaz web para un
              análisis fácil y una toma de decisiones informada.
            </p>
          </div>
          <div className="invisible md:visible bg-gray-100 size-[600px] relative overflow-hidden rounded-3xl">
            {imagesc1.map((img, i) => (
              <img key={i} src={img} alt={`Presentation ${i+1}`} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === current ? 'opacity-100' : 'opacity-0'}`} />
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 px-6 dark:text-gray-50 lg:scroll-mt-28">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-5xl font-bold text-center mb-25">Como funciona</h3>
          <div className="flex items-center gap-8 pb-10">
            <div className="relative flex-1 px-2">
              <div className="relative flex items-center justify-center gap-4 h-full min-h-[260px] overflow-visible">
                {howCards.map((card, index) => {
                  const offset = getHowCardPosition(index);
                  const isCenter = offset === 0;

                  return (
                    <Card
                      key={`${card.title}-${index}`}
                      className={`absolute w-full max-w-[320px] rounded-2xl shadow-md overflow-visible transition-all duration-700 ease-out ${isCenter ? "scale-100 opacity-100 z-20" : "scale-95 opacity-70 z-10"}`}
                      style={{
                        transform: `translateX(${offset * 125}%) scale(${isCenter ? 1 : 0.96})`,
                        transition: "transform 700ms ease, opacity 700ms ease, scale 700ms ease",
                      }}
                    >
                      <CardContent className="p-6 rounded-2xl overflow-visible">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex-shrink-0">{card.icon}</div>
                          <h4 className="font-semibold text-xl">{card.title}</h4>
                        </div>
                        <p className="text-lg text-gray-600 dark:text-gray-50 leading-relaxed">{card.description}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-5 px-2 md:py-12 md:px-15 h-[calc(100lvh-80px)] w-full bg-gray-50 dark:bg-gray-950 lg:scroll-mt-28">
        <div className="max-w-8xl mx-auto">
          <h3 className="text-5xl font-bold text-center mb-12">Prestaciones</h3>
          <div className="w-full grid md:grid-cols-3 gap-12">
            <div className="relative grid md:grid-rows-2">
              <Feature icon={<SolarPanel className="size-10" color="Orange"/>} title="Alimentación Solar" description="Proporciona energía renovable para el funcionamiento del dispositivo." />
              <Feature icon={<Thermometer className="size-10" color="Orange"/>} title="Temperatura" description="Mide y analiza la temperatura del ganado durante la actividad." />
            </div>
            <div className="bg-gray-100 rounded-2xl max-h-9/10 w-full relative overflow-hidden">
              <img src={greenField} alt="Green Field" className="rounded-2xl w-full h-full object-cover" />
            </div>
            <div className="relative grid md:grid-rows-2">
              <Feature icon={<Radio className="size-10" color="Green"/>} title="Comunicación LoRa" description="Permite la comunicación inalámbrica entre los AgroNeck y el AgroBot." />
              <Feature icon={<MapPin className="size-10" color="Green"/>} title="Seguimiento GPS" description="Realiza un seguimiento preciso de la ubicación del ganado en tiempo real." />
            </div>
          </div>
        </div>
      </section>

      {/* TECHNOLOGY */}
      <section id="tech" className="py-20 px-6 dark:text-gray-50 lg:scroll-mt-28">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="invisible md:visible bg-gray-100 rounded-2xl h-[500px] w-[500px] relative overflow-hidden mx-auto">
            {imagesc2.map((img, i) => (
              <img key={i} src={img} alt={`Presentation ${i+1}`} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === current ? 'opacity-100' : 'opacity-0'}`} />
            ))}
          </div>
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-5xl font-bold mb-16">Tecnología utilizada</h3>
            <ul className="text-gray-600 dark:text-gray-50 space-y-5 text-xl font-light text-left list-disc list-inside">
              <li>Microcontrolador ESP32</li>
              <li>Módulo GPS</li>
              <li>Sensores de movimiento, temperatura y frecuencia cardíaca</li>
              <li>Comunicación inalámbrica (LoRa / GSM / WiFi)</li>
              <li>Interfaz de monitoreo web y física</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-15 px-6 bg-gray-50 dark:bg-gray-950 lg:scroll-mt-28">
        <div className="max-w-4xl mx-auto space-y-3 text-center">
          <h3 className="text-4xl font-bold mb-10">Contacto</h3>
          <a className="flex items-center justify-center space-x-2 w-fit mx-auto" href="https://maps.app.goo.gl/AHRDNMTGLFKU1UtW8" target="_blank" rel="noopener noreferrer">
            <img src={logoMaps} alt="Maps" className="w-6 h-6" />
            <p className="text-gray-600 dark:text-gray-50">E.E.S.T N.7 ("T.R.Q"), Quilmes, Buenos Aires</p>
          </a>
          <a className="flex items-center justify-center space-x-2 w-fit mx-auto" href="mailto:nomadbusiness2026@gmail.com" target="_blank" rel="noopener noreferrer">
            <img src={logoGmail} alt="Gmail" className="w-7 h-6" />
            <p className="text-gray-600 dark:text-gray-50">nomadbusiness2026@gmail.com</p>
          </a>
          <a className="flex items-center justify-center space-x-2 w-fit mx-auto" href="https://www.instagram.com/proyecto.agronomad" target="_blank" rel="noopener noreferrer">
            <img src={logoIg} alt="Instagram" className="w-6 h-6" />
            <p className="text-gray-600 dark:text-gray-50">@proyecto.agronomad</p>
          </a>
          <a className="flex items-center justify-center space-x-2 w-fit mx-auto" href="https://www.tiktok.com/@proyecto.agronomad" target="_blank" rel="noopener noreferrer">
            <img src={logoTiktok} alt="TikTok" className="w-6 h-6" />
            <p className="text-gray-600 dark:text-gray-50">@proyecto.agronomad</p>
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 text-center border-t">
        <p className="text-gray-500 dark:text-gray-50">© 2026 AgroNomad - Monitoreo Inteligente de Ganado</p>
      </footer>
    </div>
  );
}

function Feature({ icon, title, description }) {
  return (
    <Card className="max-h-3/4 rounded-2xl">
      <CardContent className="items-center p-8">
        <div className="flex items-center justify-center gap-4 mt-4 mb-12">
          <div className="flex-shrink-0">{icon}</div>
          <h4 className="font-semibold text-3xl text-left">{title}</h4>
        </div>
        <h5 className="text-2xl text-center align-middle font-light text-gray-600 dark:text-gray-50 mx-2">{description}</h5>
      </CardContent>
    </Card>
  );
}