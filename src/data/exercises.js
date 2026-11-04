export const exercises = [
  {
    id: "neck-stretch",
    title: "Estiramiento Lateral de Cuello",
    category: "cuello",
    intensity: "Baja",
    equipment: "Ninguno",
    description: "Alivia la tensión muscular acumulada en el cuello y trapecios superior debido al uso prolongado de pantallas.",
    steps: [
      { title: "Preparación", duration: 5, instruction: "Siéntate derecho con hombros relajados y suelta la tensión." },
      { title: "Lado derecho", duration: 15, instruction: "Inclina suavemente la cabeza hacia el hombro derecho. Apoya la mano derecha sin forzar y mantén 15 segundos respirando hondo." },
      { title: "Transición", duration: 5, instruction: "Regresa la cabeza lentamente al centro y relaja ambos hombros." },
      { title: "Lado izquierdo", duration: 15, instruction: "Inclina suavemente la cabeza hacia el hombro izquierdo. Apoya la mano izquierda y mantén 15 segundos respirando profundo." },
      { title: "Finalización", duration: 5, instruction: "Regresa al centro despacio, realiza una inhalación profunda y relaja la zona cervical." }
    ]
  },
  {
    id: "shoulder-rolls",
    title: "Rotación de Hombros y Omóplatos",
    category: "hombros",
    intensity: "Baja",
    equipment: "Ninguno",
    description: "Moviliza la articulación escapular y ayuda a relajar los hombros corrigiendo la postura encorvada.",
    steps: [
      { title: "Preparación", duration: 5, instruction: "Espalda recta, brazos sueltos a los lados y cuello alineado." },
      { title: "Giros hacia atrás", duration: 15, instruction: "Realiza círculos amplios y lentos con ambos hombros hacia atrás durante 15 segundos, sintiendo cómo se juntan los omóplatos." },
      { title: "Pausa breve", duration: 5, instruction: "Detén el giro al centro, baja los hombros y respira profundamente." },
      { title: "Giros hacia adelante", duration: 15, instruction: "Invierte el sentido y realiza círculos suaves hacia adelante durante otros 15 segundos." },
      { title: "Descanso", duration: 5, instruction: "Deja caer los hombros con suavidad, sacude ligeramente las manos y relaja." }
    ]
  },
  {
    id: "chest-opener",
    title: "Apertura de Pecho y Espalda",
    category: "espalda",
    intensity: "Media",
    equipment: "Silla",
    description: "Combate la postura encorvada abriendo la caja torácica e incrementando la capacidad respiratoria.",
    steps: [
      { title: "Posición inicial", duration: 5, instruction: "Siéntate al borde de la silla con pies firmes en el suelo y entrelaza las manos detrás de la espalda." },
      { title: "Apertura profunda", duration: 20, instruction: "Inhala elevando el pecho, lleva hombros hacia atrás y mantén la apertura durante 20 segundos con respiración serena." },
      { title: "Descanso intermedio", duration: 5, instruction: "Suelta las manos suavemente, redondea la espalda hacia adelante y exhala." },
      { title: "Segunda apertura", duration: 20, instruction: "Vuelve a abrir el pecho, proyecta el esternón hacia arriba y mantén 20 segundos respirando hondo." },
      { title: "Cierre", duration: 5, instruction: "Regresa los brazos a los costados y descansa sintiendo el torso abierto y despejado." }
    ]
  },
  {
    id: "eye-relief",
    title: "Descanso Visual Regla 20-20-20",
    category: "fatiga visual",
    intensity: "Baja",
    equipment: "Ninguno",
    description: "Regla recomendada por oftalmólogos para relajar los músculos oculares y reducir la resequedad digital.",
    steps: [
      { title: "Aparta la mirada", duration: 5, instruction: "Aparta por completo la vista del monitor o pantalla de tu teléfono." },
      { title: "Enfoque lejano", duration: 20, instruction: "Fija la mirada en un objeto lejano a más de 6 metros (20 pies). Mantén la vista fija y relajada durante 20 segundos." },
      { title: "Cierre y lubricación", duration: 10, instruction: "Cierra suavemente los ojos durante 10 segundos para hidratar la córnea y calmar la tensión." },
      { title: "Regreso", duration: 5, instruction: "Abre los ojos despacio sintiendo tu vista renovada y descansada." }
    ]
  },
  {
    id: "wrist-stretch",
    title: "Estiramiento y Prevención de Muñecas",
    category: "muñecas",
    intensity: "Baja",
    equipment: "Ninguno",
    description: "Ideal para prevenir el síndrome del túnel carpiano y tendinitis por tipeo prolongado y uso de ratón.",
    steps: [
      { title: "Flexión derecha", duration: 15, instruction: "Brazo derecho al frente, dedos hacia abajo. Con la mano izquierda presiona suavemente los dedos hacia tu cuerpo durante 15 segundos." },
      { title: "Extensión derecha", duration: 15, instruction: "Mano derecha con dedos hacia arriba y palma al frente. Presiona suavemente hacia ti durante 15 segundos." },
      { title: "Flexión izquierda", duration: 15, instruction: "Brazo izquierdo al frente, dedos hacia abajo. Presiona con la mano derecha suavemente hacia ti durante 15 segundos." },
      { title: "Extensión izquierda", duration: 15, instruction: "Mano izquierda con dedos hacia arriba y palma al frente. Presiona suavemente hacia atrás durante 15 segundos." },
      { title: "Sacudida articular", duration: 10, instruction: "Sacude ambas manos y gira muñecas libremente en círculos suaves durante 10 segundos." }
    ]
  },
  {
    id: "box-breathing",
    title: "Respiración Cuadrada (Box Breathing)",
    category: "respiración",
    intensity: "Baja",
    equipment: "Ninguno",
    description: "Técnica de respiración utilizada para regular el sistema nervioso, aliviar la ansiedad laboral y enfocar la mente.",
    steps: [
      { title: "Preparación", duration: 4, instruction: "Siéntate cómodo, cierra los ojos y exhala todo el aire de tus pulmones." },
      { title: "Ciclo 1: Inhala", duration: 4, instruction: "Inhala aire por la nariz lentamente: 1... 2... 3... 4." },
      { title: "Ciclo 1: Retén", duration: 4, instruction: "Mantén el aire en los pulmones: 1... 2... 3... 4." },
      { title: "Ciclo 1: Exhala", duration: 4, instruction: "Exhala suavemente por la boca: 1... 2... 3... 4." },
      { title: "Ciclo 1: Pausa", duration: 4, instruction: "Permanece con pulmones vacíos en calma: 1... 2... 3... 4." },
      { title: "Ciclo 2: Inhala", duration: 4, instruction: "Inhala profundo llenando tu abdomen: 1... 2... 3... 4." },
      { title: "Ciclo 2: Retén", duration: 4, instruction: "Sostén con serenidad: 1... 2... 3... 4." },
      { title: "Ciclo 2: Exhala", duration: 4, instruction: "Suelta el aire liberando tensiones: 1... 2... 3... 4." },
      { title: "Ciclo 2: Pausa", duration: 4, instruction: "Pausa en calma sin forzar: 1... 2... 3... 4." },
      { title: "Ciclo 3: Inhala", duration: 4, instruction: "Inhala aire fresco y renovador: 1... 2... 3... 4." },
      { title: "Ciclo 3: Retén", duration: 4, instruction: "Mantén la quietud mental: 1... 2... 3... 4." },
      { title: "Ciclo 3: Exhala", duration: 4, instruction: "Exhala despacio y profundo: 1... 2... 3... 4." },
      { title: "Ciclo 3: Pausa", duration: 4, instruction: "Última pausa en tranquilidad: 1... 2... 3... 4." },
      { title: "Regreso", duration: 8, instruction: "Abre los ojos lentamente y respira a tu ritmo natural sintiendo serenidad." }
    ]
  },
  {
    id: "spinal-twist",
    title: "Torsión de Columna en Silla",
    category: "espalda",
    intensity: "Baja",
    equipment: "Silla",
    description: "Descomprime las vértebras y estira la musculatura paravertebral dorsolumbar tras períodos sentado.",
    steps: [
      { title: "Preparación", duration: 5, instruction: "Siéntate erguido con los pies firmes y las rodillas juntas." },
      { title: "Torsión derecha", duration: 15, instruction: "Gira el tronco hacia la derecha sujetando el respaldo de la silla. Mantén 15 segundos respirando lento." },
      { title: "Centro", duration: 5, instruction: "Regresa suavemente al centro, alarga la columna e inhala profundo." },
      { title: "Torsión izquierda", duration: 15, instruction: "Gira el tronco hacia la izquierda sujetando la silla. Mantén 15 segundos sintiendo el estiramiento." },
      { title: "Cierre", duration: 5, instruction: "Regresa al centro despacio, relaja los hombros y apoya la espalda recta." }
    ]
  },
  {
    id: "leg-activation",
    title: "Activación y Circulación de Piernas",
    category: "piernas",
    intensity: "Baja",
    equipment: "Silla",
    description: "Estimula el retorno venoso, alivia la pesadez en las piernas y despierta la circulación.",
    steps: [
      { title: "Bombeo de talones", duration: 15, instruction: "Con los pies en el suelo, sube y baja los talones de manera rítmica durante 15 segundos apoyando las puntas." },
      { title: "Círculos tobillo derecho", duration: 10, instruction: "Eleva levemente el pie derecho y gira el tobillo en círculos amplios durante 10 segundos." },
      { title: "Círculos tobillo izquierdo", duration: 10, instruction: "Eleva el pie izquierdo y realiza giros suaves de tobillo durante 10 segundos." },
      { title: "Extensión activa", duration: 10, instruction: "Extiende ambas piernas al frente manteniendo los pies suspendidos 10 segundos para activar muslos y rodillas." }
    ]
  }
].map((ex) => {
  // Ensure duration is always calculated accurately as the sum of all step durations
  const totalDuration = ex.steps.reduce((sum, s) => sum + s.duration, 0);
  return {
    ...ex,
    duration: totalDuration,
    instructions: ex.steps.map((s) => s.instruction)
  };
});
