"""Certificado de donación en PDF (reportlab)."""
from io import BytesIO

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

VERDE = colors.HexColor("#1F7A4D")
NARANJA = colors.HexColor("#E8833A")
GRIS = colors.HexColor("#5B6660")


def certificado_pdf(cert, url_verificacion=""):
    d = cert.donacion
    recogida = getattr(d, "recogida", None)
    receptor = recogida.asignacion.receptor.razon_social if recogida else "—"
    entregada = timezone.localtime(recogida.entregada_en) if recogida and recogida.entregada_en else timezone.localtime(cert.emitido_en)

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    ancho, alto = letter
    c.setTitle(f"Certificado {cert.consecutivo}")
    # Marco
    c.setStrokeColor(VERDE); c.setLineWidth(3); c.rect(1.5 * cm, 1.5 * cm, ancho - 3 * cm, alto - 3 * cm)
    c.setStrokeColor(NARANJA); c.setLineWidth(1); c.rect(1.8 * cm, 1.8 * cm, ancho - 3.6 * cm, alto - 3.6 * cm)
    # Encabezado
    c.setFillColor(VERDE); c.setFont("Helvetica-Bold", 28); c.drawCentredString(ancho / 2, alto - 4.2 * cm, "ReParte")
    c.setFillColor(GRIS); c.setFont("Helvetica", 11)
    c.drawCentredString(ancho / 2, alto - 5 * cm, "Redistribución de excedentes de alimentos")
    c.setFillColor(colors.black); c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(ancho / 2, alto - 7 * cm, "CERTIFICADO DE DONACIÓN")
    c.setFont("Helvetica", 12); c.setFillColor(NARANJA)
    c.drawCentredString(ancho / 2, alto - 7.8 * cm, f"N.° {cert.consecutivo}")
    # Cuerpo
    c.setFillColor(colors.black); c.setFont("Helvetica", 12)
    y = alto - 10 * cm
    texto = [
        "Se certifica que",
        None,
        "donó alimentos aptos para el consumo humano que fueron entregados a",
        None,
        "a través de la plataforma ReParte, con el siguiente detalle:",
    ]
    nombres = [d.donante.razon_social, receptor]
    for linea in texto:
        if linea is None:
            c.setFont("Helvetica-Bold", 15); c.drawCentredString(ancho / 2, y, nombres.pop(0)); c.setFont("Helvetica", 12)
        else:
            c.drawCentredString(ancho / 2, y, linea)
        y -= 0.9 * cm
    y -= 0.4 * cm
    filas = [
        ("Donación", d.codigo), ("Descripción", d.descripcion[:70]), ("Categoría", d.categoria.nombre),
        ("Cantidad certificada", f"{cert.kg_certificados} kg"), ("NIT del donante", d.donante.nit),
        ("Fecha de entrega", entregada.strftime("%d/%m/%Y %H:%M")),
    ]
    for etiqueta, valor in filas:
        c.setFillColor(GRIS); c.setFont("Helvetica", 11); c.drawString(4.5 * cm, y, etiqueta)
        c.setFillColor(colors.black); c.setFont("Helvetica-Bold", 11); c.drawString(9.5 * cm, y, str(valor))
        y -= 0.75 * cm
    # Verificación
    y -= 0.8 * cm
    c.setFillColor(GRIS); c.setFont("Helvetica", 9)
    c.drawCentredString(ancho / 2, y, "Huella de verificación (SHA-256):")
    c.setFont("Courier", 8); c.drawCentredString(ancho / 2, y - 0.5 * cm, cert.hash_sha256)
    if url_verificacion:
        c.setFont("Helvetica", 9); c.drawCentredString(ancho / 2, y - 1.2 * cm, f"Verificar en: {url_verificacion}")
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(ancho / 2, 2.4 * cm, "Documento generado en modo de simulación (proyecto académico). "
                                              "No reemplaza el certificado tributario de la entidad receptora.")
    c.showPage(); c.save()
    return buf.getvalue()
