"""Reportes descargables para el administrador: Excel (openpyxl) y PDF (reportlab)."""
from io import BytesIO

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.donaciones.models import Donacion
from apps.logistica.models import Recogida

from .services import indicadores

ENCABEZADO = PatternFill("solid", fgColor="1F7A4D")


def _filtrar(region=None, desde=None, hasta=None):
    donaciones = Donacion.objects.select_related("donante__region", "categoria", "recogida__asignacion__receptor",
                                                 "recogida__voluntario__usuario", "calificacion")
    entregas = Recogida.objects.filter(estado="ENTREGADA")
    if region:
        donaciones = donaciones.filter(donante__region=region)
        entregas = entregas.filter(donacion__donante__region=region)
    if desde:
        donaciones = donaciones.filter(creado_en__date__gte=desde)
        entregas = entregas.filter(entregada_en__date__gte=desde)
    if hasta:
        donaciones = donaciones.filter(creado_en__date__lte=hasta)
        entregas = entregas.filter(entregada_en__date__lte=hasta)
    return donaciones.order_by("creado_en"), entregas


def _hoja(wb, titulo, columnas, filas, primera=False):
    ws = wb.active if primera else wb.create_sheet()
    ws.title = titulo
    ws.append(columnas)
    for celda in ws[1]:
        celda.font = Font(bold=True, color="FFFFFF")
        celda.fill = ENCABEZADO
        celda.alignment = Alignment(vertical="center")
    for f in filas:
        ws.append(list(f))
    for i, col in enumerate(columnas, start=1):
        largo = max([len(str(col))] + [len(str(f[i - 1])) for f in filas if f[i - 1] is not None] or [10])
        ws.column_dimensions[get_column_letter(i)].width = min(45, largo + 2)
    ws.freeze_panes = "A2"
    return ws


def reporte_excel(region=None, desde=None, hasta=None):
    donaciones, entregas = _filtrar(region, desde, hasta)
    wb = Workbook()
    filas = []
    for d in donaciones:
        r = getattr(d, "recogida", None)
        cal = getattr(d, "calificacion", None)
        filas.append([
            d.codigo, timezone.localtime(d.creado_en).strftime("%Y-%m-%d %H:%M"), d.donante.region.nombre,
            d.donante.razon_social, d.categoria.nombre, d.descripcion, float(d.peso_estimado_kg), d.get_condicion_display(),
            d.get_estado_display(), r.asignacion.receptor.razon_social if r else "",
            (r.voluntario.usuario.get_full_name() if r and r.voluntario else ""),
            timezone.localtime(r.entregada_en).strftime("%Y-%m-%d %H:%M") if r and r.entregada_en else "",
            cal.calidad_alimento if cal else "",
        ])
    _hoja(wb, "Donaciones", ["Código", "Publicada", "Región", "Donante", "Categoría", "Descripción", "Kg", "Conservación",
                             "Estado", "Receptor", "Voluntario", "Entregada", "Calificación"], filas, primera=True)
    por_mes = (entregas.annotate(mes=TruncMonth("entregada_en")).values("mes")
               .annotate(n=Count("id"), kg=Sum("donacion__peso_estimado_kg")).order_by("mes"))
    _hoja(wb, "Por mes", ["Mes", "Entregas", "Kg rescatados"], [[m["mes"].strftime("%Y-%m"), m["n"], float(m["kg"])] for m in por_mes])
    por_donante = (entregas.values("donacion__donante__razon_social")
                   .annotate(n=Count("id"), kg=Sum("donacion__peso_estimado_kg")).order_by("-kg"))
    _hoja(wb, "Por donante", ["Donante", "Entregas", "Kg"], [[x["donacion__donante__razon_social"], x["n"], float(x["kg"])] for x in por_donante])
    por_receptor = (entregas.values("asignacion__receptor__razon_social")
                    .annotate(n=Count("id"), kg=Sum("donacion__peso_estimado_kg")).order_by("-kg"))
    _hoja(wb, "Por receptor", ["Receptor", "Entregas", "Kg"], [[x["asignacion__receptor__razon_social"], x["n"], float(x["kg"])] for x in por_receptor])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def reporte_pdf(region=None, desde=None, hasta=None):
    _donaciones, entregas = _filtrar(region, desde, hasta)
    imp = indicadores(region=region, desde=desde, hasta=hasta)
    estilos = getSampleStyleSheet()
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm,
                            title="Reporte de impacto ReParte")
    alcance = region.nombre if region else "Todas las regiones"
    periodo = f"{desde or 'inicio'} a {hasta or timezone.localdate()}"
    flujo = [Paragraph("ReParte · Reporte de impacto", estilos["Title"]),
             Paragraph(f"{alcance} · {periodo}", estilos["Normal"]), Spacer(1, 12)]

    def tabla(datos, anchos):
        t = Table(datos, colWidths=anchos)
        t.setStyle(TableStyle([("FONT", (0, 0), (-1, 0), "Helvetica-Bold"), ("LINEBELOW", (0, 0), (-1, 0), 1, colors.black),
                               ("GRID", (0, 0), (-1, -1), 0.3, colors.grey), ("FONTSIZE", (0, 0), (-1, -1), 10),
                               ("VALIGN", (0, 0), (-1, -1), "TOP")]))
        return t

    flujo += [Paragraph("Indicadores", estilos["Heading2"]), tabla([
        ["Indicador", "Valor"],
        ["Kilos rescatados", f"{imp['kg_rescatados']} kg"], ["Donaciones entregadas", imp["donaciones_entregadas"]],
        ["Raciones equivalentes", imp["raciones_equivalentes"]], ["Receptores atendidos", imp["receptores_atendidos"]],
        ["Voluntarios activos", imp["voluntarios_activos"]],
        ["Calificación promedio", imp["calificacion_promedio"] or "Sin calificaciones"],
    ], [9 * cm, 6 * cm]), Spacer(1, 12)]
    flujo += [Paragraph("Kilos por mes", estilos["Heading2"]),
              tabla([["Mes", "Entregas", "Kg"]] + [[m["mes"], m["donaciones"], m["kg"]] for m in imp["por_mes"]],
                    [6 * cm, 4 * cm, 5 * cm]), Spacer(1, 12)]
    por_donante = (entregas.values("donacion__donante__razon_social")
                   .annotate(n=Count("id"), kg=Sum("donacion__peso_estimado_kg")).order_by("-kg")[:10])
    flujo += [Paragraph("Principales donantes", estilos["Heading2"]),
              tabla([["Donante", "Entregas", "Kg"]] + [[x["donacion__donante__razon_social"], x["n"], x["kg"]] for x in por_donante],
                    [9 * cm, 3 * cm, 3 * cm]), Spacer(1, 12),
              Paragraph(f"Supuesto: 1 ración ≈ {imp['supuestos']['kg_por_racion']} kg. Generado el "
                        f"{timezone.localtime().strftime('%d/%m/%Y %H:%M')} (simulación académica).", estilos["Italic"])]
    doc.build(flujo)
    return buf.getvalue()
