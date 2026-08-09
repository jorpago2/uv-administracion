const DEFAULT_RESPONSIBILITY = responsibility([
  role("Tú, como persona interesada", "Delimitas el caso, aportas datos y documentos veraces y presentas la actuación por el canal exigido. No te autorizas ni das el expediente por aprobado."),
  role("Unidad tramitadora", "Comprueba el cauce, la documentación y la integridad del expediente, pide subsanaciones y lo impulsa. Tramitar no equivale necesariamente a decidir."),
  role("Órgano competente", "Firma, autoriza o resuelve cuando la norma le atribuye esa competencia. Una conversación, un correo informativo o el silencio no sustituyen esa decisión."),
], "No des por supuesto que quien te ayuda a preparar el expediente es quien puede aprobarlo, ni que una solicitud presentada produce por sí sola el efecto solicitado.");

export const EXAMPLE_RESPONSIBILITIES = Object.freeze({
  5: responsibility([
    role("Tú", "Lees el requerimiento completo, corriges solo lo pedido y aportas la subsanación dentro del expediente y del plazo."),
    role("Unidad instructora", "Define el defecto que debe corregirse, incorpora la aportación y continúa la instrucción."),
    role("Órgano que resuelve", "Valora el expediente completo y dicta la resolución; recibir la subsanación no anticipa que vaya a estimarse."),
  ], "Responder al aviso por correo o abrir una solicitud nueva no equivale a subsanar en el expediente original."),
  6: responsibility([
    role("Tú, como proponente", "Defines necesidad, usuarios, ubicación, coste completo, mantenimiento y fuente propuesta; no encargas el equipo."),
    role("Responsables presupuestarios y de inventario", "Confirman crédito, titularidad, centro de coste, inventario y circuito de compra."),
    role("DIE, ICMUV y ETSE", "Cada estructura decide únicamente sobre las competencias, recursos y compromisos que le corresponden."),
    role("Unidad gestora", "Tramita el expediente económico después de que exista una decisión suficientemente concreta y financiación disponible."),
  ], "Que un consejo apoye la idea no significa que haya adjudicado la compra, reservado crédito ni que otra estructura haya aceptado costes futuros."),
  14: responsibility([
    role("Tú", "Separas movilidad, permiso PDI y gastos; aportas fechas, programa, cobertura docente y justificantes."),
    role("Responsable de cada financiación", "Confirma que el tramo y el concepto son elegibles y que existe saldo; una ayuda no cubre automáticamente todo el viaje."),
    role("Dirección competente", "Autoriza la ausencia o comisión de servicio dentro de su ámbito."),
    role("Unidad gestora", "Indica antes de pagar qué modalidad se usa, qué facturas se exigen y cómo se liquidará cada fuente."),
  ], "La concesión de una movilidad no autoriza por sí sola la ausencia, no cubre la docencia y no convierte en elegible cualquier gasto."),
  16: responsibility([
    role("Tú", "Solicitas la figura adecuada con invitación, memoria, fechas y propuesta de cobertura docente."),
    role("DIE", "Informa o autoriza cuando le corresponde y acredita cómo se atenderán las obligaciones docentes."),
    role("RR. HH. PDI / vicerrectorado", "Tramita y resuelve las licencias cuya duración o naturaleza excede la competencia departamental."),
    role("Unidad financiadora", "Determina, por separado, si existe crédito y derecho a indemnización."),
  ], "Tener financiación o una invitación no equivale a tener concedida la licencia; y una licencia no implica automáticamente indemnización."),
  18: responsibility([
    role("Tú", "Aportas nómina, hoja de servicios y resoluciones y señalas la diferencia por concepto y periodo."),
    role("RR. HH. PDI", "Mantiene los datos administrativos y tramita los reconocimientos que correspondan."),
    role("Unidad de nóminas", "Aplica en nómina los conceptos y efectos reconocidos y explica regularizaciones, cotizaciones y retenciones."),
    role("Órgano que reconoce el mérito", "Dicta la resolución que genera el derecho cuando el complemento no es automático."),
  ], "Que un mérito conste en el currículo no significa que esté reconocido con efectos económicos ni que la calculadora reproduzca tu líquido mensual."),
  19: responsibility([
    role("Tú", "Inventarías proyectos, personal, tesis, equipos, datos y contratos activos y propones un relevo ordenado."),
    role("Responsables de proyectos y estructuras", "Aceptan y formalizan cambios de IP, supervisión, custodia o ubicación cuando sean competentes."),
    role("RR. HH. PDI / previsión social", "Determina modalidad, fecha y efectos personales del cese o jubilación."),
    role("Financiadores y unidades gestoras", "Autorizan los cambios que afecten a ayudas, contratos o bienes sujetos a condiciones."),
  ], "Designar informalmente a un sustituto no transfiere firmas, responsabilidades ante el financiador ni custodia patrimonial."),
  20: responsibility([
    role("Tú, como IP propuesto", "Diseñas la propuesta, coordinas socios y entregas memoria, presupuesto y anexos antes del cierre interno."),
    role("SGI y unidad gestora", "Revisa elegibilidad institucional, presupuesto, firmas, documentación y presentación o validación interna."),
    role("Representante legal de la UV", "Asume las declaraciones y compromisos institucionales que exigen firma o validación de la entidad."),
    role("Entidad financiadora", "Evalúa y resuelve; la validación interna UV no garantiza concesión."),
  ], "El IP prepara y dirige científicamente, pero no debe firmar en nombre de la UV ni comprometer aportaciones institucionales sin autorización."),
  21: responsibility([
    role("Tú, como usuario o IP", "Justificas la necesidad, verificas recepción y uso y comunicas cualquier cambio previsto."),
    role("Unidad gestora e inventario", "Vincula compra, factura, alta patrimonial, ubicación y proyecto."),
    role("Titular del bien / estructura", "Custodia y decide el uso interno dentro de sus competencias."),
    role("Entidad financiadora", "Puede imponer permanencia, finalidad o autorización previa para traslado, cesión o baja."),
  ], "Pagar el equipo con un proyecto no convierte al IP en propietario ni permite moverlo o cederlo libremente."),
  22: responsibility([
    role("Tú, como IP o supervisor", "Define funciones, perfil y financiación y planifica la acogida; no permite trabajar antes del alta."),
    role("Unidad gestora", "Comprueba elegibilidad y coste completo y reserva la imputación presupuestaria."),
    role("RR. HH. de investigación", "Determina modalidad, publica o tramita la selección y formaliza contrato y alta."),
    role("Órgano o comisión de selección", "Aplica el baremo y documenta la decisión con imparcialidad."),
  ], "Tener una persona elegida o presupuesto disponible no autoriza una incorporación ni sustituye el proceso de selección y el alta."),
  23: responsibility([
    role("Tú, como responsable científico", "Defines alcance, entregables, medios, calendario y necesidades de publicación o propiedad intelectual."),
    role("Transferencia", "Califica el instrumento, calcula o revisa costes, negocia cláusulas y conduce la tramitación institucional."),
    role("Órgano competente de la UV", "Aprueba y firma el contrato o convenio en nombre de la Universitat."),
    role("Empresa o entidad contratante", "Acepta precio, entregables, riesgos, confidencialidad y derechos mediante el instrumento firmado."),
  ], "Una oferta técnica, una reunión o un correo de aceptación no autorizan a empezar trabajos ni a facturar en nombre de la UV."),
  24: responsibility([
    role("Inventores y autores", "Comunican el resultado, documentan contribuciones y evitan divulgarlo antes de decidir la protección."),
    role("Transferencia", "Evalúa protegibilidad, titularidad, estrategia, costes y explotación y coordina la tramitación."),
    role("Universitat de València", "Ejercita los derechos que legal o contractualmente le correspondan y adopta las decisiones institucionales."),
    role("Financiadores y socios", "Pueden tener derechos de información, revisión o explotación según la ayuda, contrato o convenio."),
  ], "Autoría científica, inventoría y titularidad son conceptos distintos; incluir a alguien en un artículo no lo convierte automáticamente en inventor."),
  27: responsibility([
    role("Equipo promotor", "Define oportunidad, activos UV necesarios, socios, funciones y plan de negocio sin constituir ni comprometer todavía a la UV."),
    role("Transferencia", "Evalúa encaje como empresa basada en conocimiento, derechos, licencia, participación y conflicto de interés."),
    role("Órganos UV competentes", "Reconocen o autorizan la relación institucional y los instrumentos sobre activos o participación."),
    role("RR. HH. PDI / compatibilidad", "Determina si las funciones privadas o societarias son compatibles con la dedicación pública."),
  ], "Crear una sociedad mercantil no autoriza a usar resultados, marca, equipos, personal o tiempo de la UV ni resuelve la compatibilidad del PDI."),
  28: responsibility([
    role("Usuario que detecta la incidencia", "Detiene usos críticos, identifica datos potencialmente afectados y registra síntomas y fechas."),
    role("Responsable del equipo", "Decide el estado de servicio, coordina acceso, mantenimiento y comunicación a usuarios."),
    role("Unidad gestora / proveedor", "Tramita reparación, garantía o calibración y entrega evidencia técnica y económica."),
    role("Dirección de la estructura", "Resuelve prioridades, recursos y reapertura cuando excede la gestión ordinaria."),
  ], "Que el equipo vuelva a encender o produzca una señal plausible no demuestra que los datos sean válidos ni autoriza su reapertura."),
  29: responsibility([
    role("Tú, como solicitante", "Defines la necesidad completa, referencia, cantidad, justificación, destino y fecha; no confirmas el pedido por tu cuenta."),
    role("Responsable de los fondos", "Confirma crédito, elegibilidad y centro de coste y presta la conformidad que corresponda."),
    role("Unidad gestora / comprador autorizado", "Elige el circuito aplicable, crea el expediente o pedido y ejecuta la compra tras las aprobaciones."),
    role("Proveedor", "Suministra después de recibir el pedido válido y emite la factura con los datos y referencias exigidos."),
  ], "Tener presupuesto o una oferta no te convierte en comprador autorizado; pagar personalmente una lente no garantiza que la UV pueda reintegrarla."),
  30: responsibility([
    role("Tú, como asistente", "Solicitas la comisión, aportas programa y fechas, eliges una opción admisible con la unidad y conservas toda la justificación. Solo adelantas dinero si la modalidad está confirmada."),
    role("Responsable de los fondos", "Confirma crédito, elegibilidad y clave; si son fondos de investigación, firma la orden y la liquidación para admitir la imputación."),
    role("Dirección competente", "Autoriza y verifica la comisión de servicio. La existencia de crédito o la aceptación del congreso no sustituyen esta autorización."),
    role("Unidad gestora / caja fija", "Te indica y tramita pago directo, reintegro o anticipo; contabiliza y liquida la documentación admisible."),
  ], "No existe una obligación general de que el profesor adelante todo. Si la actividad la organiza la propia UV, no pagues la inscripción: se tramita exclusivamente por compensación interna y un adelanto personal no es reintegrable."),
  31: responsibility([
    role("Tú, al detectar el incidente", "Contienes el acceso sin destruir evidencias y comunicas hechos, alcance y fechas de inmediato."),
    role("Seguridad de la información", "Analiza el incidente técnico, preserva evidencias y coordina medidas de contención y recuperación."),
    role("Delegación de Protección de Datos", "Valora si existe brecha de datos personales, riesgo y obligaciones de notificación o comunicación."),
    role("Responsable institucional", "Adopta las decisiones y comunicaciones externas que correspondan; no recaen en el profesor individual."),
  ], "Avisar por tu cuenta a todas las personas o borrar el archivo y los registros puede agravar el incidente y dificultar su evaluación."),
  32: responsibility([
    role("Tú, como IP", "Describes protocolo real, muestras, datos, riesgos, consentimiento y responsabilidades antes de iniciar."),
    role("CEIH / Comité de Bioseguridad", "Evalúa únicamente el ámbito que le corresponde y emite informe; uno no sustituye al otro."),
    role("DPD, PRL y unidades técnicas", "Informan sobre datos, seguridad y condiciones operativas cuando intervienen esos riesgos."),
    role("Instituciones participantes", "Formalizan convenios, transferencias y responsabilidades sobre muestras y datos."),
  ], "Un dictamen ético favorable no autoriza automáticamente bioseguridad, protección de datos, recepción de muestras ni el acuerdo entre instituciones."),
  33: responsibility([
    role("Tú, como responsable científico o usuario", "Describes modos reales de uso y mantenimiento y no operas fuera de la formación y autorización recibidas."),
    role("Responsable del laboratorio", "Controla acceso, procedimientos, señalización, interbloqueos y registros de formación."),
    role("Servicio de Prevención", "Evalúa riesgos y asesora sobre medidas preventivas; no sustituye la ejecución diaria del responsable del laboratorio."),
    role("Dirección de la estructura", "Aporta autoridad y recursos para corregir riesgos o mantener la instalación fuera de servicio."),
  ], "Comprar gafas o disponer del marcado CE del láser no demuestra que la instalación completa sea segura."),
  35: responsibility([
    role("Tú", "Declaras actividad, dedicación, horario, remuneración, empresa y relación con tus funciones antes de contratar o facturar."),
    role("RR. HH. PDI", "Identifica el régimen aplicable y tramita la solicitud o informa del cauce formal."),
    role("Órgano competente", "Reconoce o deniega compatibilidad cuando es exigible."),
    role("Estructura UV afectada", "Gestiona abstención, recursos, datos, propiedad intelectual y demás conflictos concretos."),
  ], "Que la actividad sea ocasional, se haga fuera del horario o no use un laboratorio UV no permite concluir por sí solo que sea compatible."),
  36: responsibility([
    role("Tú, como recurrente", "Controlas la notificación, accedes al expediente, formulas hechos, fundamentos y petición y registras dentro de plazo."),
    role("Unidad de registro o instructora", "Recibe, incorpora y tramita el escrito, pero no necesariamente decide el fondo."),
    role("Órgano indicado en el pie de recursos", "Resuelve el recurso dentro de su competencia."),
    role("Asesoramiento profesional", "Puede ayudarte a valorar estrategia y argumentos, pero no sustituye la presentación formal."),
  ], "Una queja, mediación, consulta sindical o correo no interrumpe el plazo del recurso salvo que la norma lo prevea expresamente."),
  37: responsibility([
    role("Tú, como informante", "Comunicas hechos y evidencias obtenidas legítimamente, limitas datos y conservas el código de seguimiento."),
    role("Responsable del sistema interno", "Recibe, acusa recibo, protege la confidencialidad y decide la admisión y tramitación."),
    role("Órgano investigador o competente", "Comprueba los hechos y adopta medidas o deriva cuando corresponde."),
    role("Personas afectadas", "Conservan sus derechos de defensa y protección de datos durante la tramitación."),
  ], "El canal interno no es un medio para hacer acusaciones públicas ni sustituye los recursos ordinarios contra una resolución."),
});

export function responsibilitiesFor(chapterNumber) {
  return EXAMPLE_RESPONSIBILITIES[chapterNumber] ?? DEFAULT_RESPONSIBILITY;
}

function responsibility(roles, doNotAssume) {
  return Object.freeze({ roles: Object.freeze(roles), doNotAssume });
}

function role(actor, task) {
  return Object.freeze({ actor, task });
}
