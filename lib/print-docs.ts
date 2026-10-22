import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Business, Driver, Order, OrderItem } from './types';

/**
 * Formatage des montants avec espaces normales (ASCII 32) et la devise du commerce.
 * Pas d'espace insécable fine de toLocaleString.
 */
export function formatAmount(
  amount: number | string | undefined | null,
  currency: string
): string {
  const num = typeof amount === 'number' ? amount : Number(amount || 0);
  const rounded = Math.round(num);
  const formattedNumber = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formattedNumber} ${currency}`;
}

/**
 * Référence courte unique d'une commande :
 * Retourne les 6 premiers caractères de l'identifiant sans le préfixe « order_ » (exemple « e91cb9 »).
 */
export function getOrderShortRef(
  order: { id: string } | string | null | undefined
): string {
  if (!order) return '';
  const rawId = typeof order === 'string' ? order : order.id;
  if (!rawId) return '';
  return rawId.replace(/^order_/, '').slice(0, 6);
}

/**
 * Charge une URL d'image en dataURL (base64) pour jsPDF.
 * Si le chargement échoue ou expire, retourne null sans lever d'erreur.
 */
async function loadImageAsDataUrl(url?: string | null): Promise<string | null> {
  if (!url || !url.trim()) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url.trim(), { signal: controller.signal, mode: 'cors' });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(typeof reader.result === 'string' ? reader.result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Ouvre le PDF généré dans un nouvel onglet via URL blob.
 * Si le navigateur bloque l'ouverture (pop-up blocker), télécharge le fichier.
 */
function openOrDownloadPdf(doc: jsPDF, filename: string): void {
  try {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      doc.save(filename);
    }
  } catch {
    doc.save(filename);
  }
}

/**
 * Libellé formaté unique du moyen de paiement :
 * - wave -> Wave
 * - orange_money ou orange -> Orange Money
 * - card, paydunya, cinetpay (ou carte) -> Carte
 * - cash (ou especes / espèces) -> Espèces
 * - sinon la valeur avec majuscule initiale.
 * Jamais de code brut. Utilisé pour les tickets et la feuille de route.
 */
export function getPaymentMethodLabel(method?: string | null): string {
  if (!method || !method.trim()) return 'Non spécifié';
  const m = method.trim().toLowerCase();
  if (m === 'wave') return 'Wave';
  if (m === 'orange_money' || m === 'orange') return 'Orange Money';
  if (m === 'card' || m === 'paydunya' || m === 'cinetpay' || m === 'carte') return 'Carte';
  if (m === 'cash' || m === 'especes' || m === 'espèces') return 'Espèces';
  return m.charAt(0).toUpperCase() + m.slice(1);
}

export function getPaymentStatusLabel(status?: string | null): string {
  if (!status) return 'À encaisser';
  const s = status.toLowerCase();
  if (s === 'paid') return 'Payé';
  if (s === 'pending') return 'En attente';
  if (s === 'failed') return 'Échoué';
  if (s === 'refunded') return 'Remboursé';
  return 'À encaisser';
}

export { getOrderStatusLabel } from './order-status';

/**
 * 1. Construction du document jsPDF de la Feuille de route A4 portrait.
 * Nouvelle mise en page A4 portrait, marges 14 mm :
 * - En-tête : logo à gauche (config.invoice.logo_url), nom légal et téléphone ;
 *   à droite « FEUILLE DE ROUTE » en gras, la date et un numéro « FR-AAAAMMJJ-<initiales du livreur> ».
 * - Bloc d'informations sur une ligne de 4 cases : Livreur (nom et tél), Date, Arrêts, Zones.
 * - Tableau : N° | Client (nom, téléphone dessous) | Adresse | Plats | Montant | Paiement (court : « Payé · Wave ») | Livré ☐ | Encaissé ☐
 *   Cases carrées vides à cocher à la main, séparation par zone, largeurs fixes sans coupure.
 * - Bloc Remarques : cadre de 3 lignes à remplir à la main.
 * - Pied : arrêts, total des commandes, À encaisser, deux cadres de signature « Livreur » et « Responsable » avec « Date et heure ».
 * - Thème sobre (vert #1B4B4A, gris clair), sans icône, texte en 8 à 9 pt, répétition de l'en-tête du tableau et « Page n / n ».
 */
export async function buildRouteDoc(
  driver: Driver,
  orders: Order[],
  itemsByOrder: Record<string, OrderItem[]>,
  business: Business
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182 mm
  let currentY = 14;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const driverInitials = (driver.name || 'L')
    .trim()
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 4) || 'LV';
  const routeNumber = `FR-${yyyy}${mm}${dd}-${driverInitials}`;

  // 1. En-tête : logo à gauche (config.invoice.logo_url, sans erreur s'il manque)
  const logoUrl = business.config?.invoice?.logo_url || business.logo_url;
  const logoDataUrl = await loadImageAsDataUrl(logoUrl);
  let headerLeftX = margin;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, currentY, 26, 16);
      headerLeftX = margin + 30;
    } catch {
      headerLeftX = margin;
    }
  }

  // Nom légal et téléphone du commerce
  const legalName = business.config?.invoice?.legal_name || business.name || 'Commerce';
  const businessPhone = business.config?.invoice?.phone || business.whatsapp_number;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(27, 75, 74); // #1B4B4A
  doc.text(legalName, headerLeftX, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  if (businessPhone && businessPhone.trim()) {
    doc.text(`Tél : ${businessPhone.trim()}`, headerLeftX, currentY + 10.5);
  }

  // À droite : « FEUILLE DE ROUTE » en gras, la date et numéro « FR-AAAAMMJJ-<initiales du livreur> »
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(27, 75, 74);
  doc.text('FEUILLE DE ROUTE', pageWidth - margin, currentY + 5, { align: 'right' });

  const todayFormatted = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const dateFormattedStr = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(dateFormattedStr, pageWidth - margin, currentY + 10.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(routeNumber, pageWidth - margin, currentY + 15.5, { align: 'right' });

  currentY += 21;

  // Calcul des montants totaux et à encaisser
  const totalOrdersAmount = orders.reduce(
    (sum, o) => sum + Number(o.total_amount || 0),
    0
  );
  const toCollectAmount = orders
    .filter((o) => o.payment_status !== 'paid')
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  // 2. Bloc d'informations sur une ligne de 4 cases : Livreur (nom et téléphone), Date, Arrêts, À encaisser
  const infoBoxY = currentY;
  const infoBoxHeight = 15;
  doc.setFillColor(248, 250, 252); // Gris clair #F8FAFC
  doc.setDrawColor(226, 232, 240); // #E2E8F0
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, infoBoxY, contentWidth, infoBoxHeight, 2, 2, 'FD');

  const colW = contentWidth / 4; // 45.5 mm
  for (let i = 1; i < 4; i++) {
    doc.line(margin + i * colW, infoBoxY, margin + i * colW, infoBoxY + infoBoxHeight);
  }

  // Case 1 : Livreur
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('LIVREUR', margin + 3.5, infoBoxY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const driverNameLines = doc.splitTextToSize(driver.name, colW - 7);
  doc.text(driverNameLines[0] || driver.name, margin + 3.5, infoBoxY + 8.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(driver.phone || 'Non renseigné', margin + 3.5, infoBoxY + 12.5);

  // Case 2 : Date
  const c2X = margin + colW;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('DATE', c2X + 3.5, infoBoxY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${dd}/${mm}/${yyyy}`, c2X + 3.5, infoBoxY + 8.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(now.toLocaleDateString('fr-FR', { weekday: 'short' }), c2X + 3.5, infoBoxY + 12.5);

  // Case 3 : Arrêts
  const c3X = margin + colW * 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('ARRÊTS', c3X + 3.5, infoBoxY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${orders.length} commande${orders.length > 1 ? 's' : ''}`, c3X + 3.5, infoBoxY + 8.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('À distribuer', c3X + 3.5, infoBoxY + 12.5);

  // Case 4 : À ENCAISSER
  const c4X = margin + colW * 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('À ENCAISSER', c4X + 3.5, infoBoxY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(toCollectAmount > 0 ? 180 : 15, toCollectAmount > 0 ? 83 : 23, toCollectAmount > 0 ? 9 : 42);
  doc.text(formatAmount(toCollectAmount, business.currency), c4X + 3.5, infoBoxY + 8.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(toCollectAmount > 0 ? 'À remettre' : 'Rien à encaisser', c4X + 3.5, infoBoxY + 12.5);

  currentY += infoBoxHeight + 5;

  // 3. Groupement des arrêts par zone pour conserver les arrêts d'une même zone consécutifs
  const zoneMap = new Map<string, { zoneName: string; orders: Order[] }>();
  for (const ord of orders) {
    const zId = ord.delivery_zone_id || '__no_zone__';
    const zName =
      ord.delivery_zone_name || (zId === '__no_zone__' ? 'Sans zone' : 'Zone non nommée');
    let group = zoneMap.get(zId);
    if (!group) {
      group = { zoneName: zName, orders: [] };
      zoneMap.set(zId, group);
    }
    group.orders.push(ord);
  }

  const zonesList = Array.from(zoneMap.values()).sort((a, b) => {
    if (a.zoneName === 'Sans zone') return 1;
    if (b.zoneName === 'Sans zone') return -1;
    return a.zoneName.localeCompare(b.zoneName, 'fr');
  });

  // Tableau : N° | Client (nom, téléphone dessous) | Adresse | Plats | Montant | Paiement (court : « Payé · Wave ») | Livré ☐ | Encaissé ☐
  const tableRows: any[] = [];
  let stopNumber = 1;

  for (const group of zonesList) {
    // Les arrêts d'une même zone restent consécutifs, sans ligne de séparation ni nom de zone affiché
    for (const ord of group.orders) {
      const refShort = getOrderShortRef(ord);
      const items = itemsByOrder[ord.id] || [];
      const dishesSummary =
        items.length > 0
          ? items.map((it) => `${it.quantity} x ${it.product_name}`).join('\n')
          : 'Articles non spécifiés';

      // Client : nom, puis téléphone sur la ligne suivante si renseigné (seulement le numéro, sans préfixe), puis #réf
      const clientName = ord.customer_name || 'Client anonyme';
      const clientPhone = ord.customer_phone?.trim();
      const clientLines = [clientName];
      if (clientPhone) {
        clientLines.push(clientPhone);
      }
      clientLines.push(`#${refShort}`);
      const clientCellText = clientLines.join('\n');

      const addressText = ord.delivery_address || 'Adresse non renseignée';

      // Montant
      const amountFormatted = formatAmount(ord.total_amount, business.currency);

      // Paiement court : « Payé · Wave »
      const pMethod = getPaymentMethodLabel(ord.payment_method);
      const isPaid = ord.payment_status === 'paid';
      const pStatusShort = isPaid ? 'Payé' : 'À encaisser';
      const paymentShortText = `${pStatusShort} · ${pMethod}`;

      tableRows.push([
        String(stopNumber),
        clientCellText,
        addressText,
        dishesSummary,
        amountFormatted,
        paymentShortText,
        '', // Case Livré (dessinée via didDrawCell)
        '', // Case Encaissé (dessinée via didDrawCell)
      ]);

      stopNumber++;
    }
  }

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'N°',
        'Client',
        'Adresse',
        'Plats',
        'Montant',
        'Paiement',
        {
          content: 'Livré',
          styles: {
            fontSize: 7,
            cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
            halign: 'center',
            overflow: 'visible',
          },
        },
        {
          content: 'Encaissé',
          styles: {
            fontSize: 7,
            cellPadding: { top: 2.2, bottom: 2.2, left: 1.5, right: 1.5 },
            halign: 'center',
            overflow: 'visible',
          },
        },
      ],
    ],
    body: tableRows,
    theme: 'grid',
    showHead: 'everyPage',
    margin: { left: margin, right: margin, top: 16, bottom: 16 },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [27, 75, 74], // #1B4B4A
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 2.2,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 38 },                                   // Client 38 mm (téléphone jamais coupé)
      2: { cellWidth: 33 },                                   // Adresse 33 mm
      3: { cellWidth: 26 },                                   // Plats
      4: { cellWidth: 23, halign: 'right', fontStyle: 'bold' }, // Montant fixe sans coupure
      5: { cellWidth: 22, fontSize: 7.5 },                    // Paiement court fixe sans coupure
      6: { cellWidth: 16, halign: 'center' },                 // Livré ☐ (16 mm, en-tête sur une seule ligne)
      7: { cellWidth: 16, halign: 'center' },                 // Encaissé ☐ (16 mm, en-tête sur une seule ligne)
    },
    didDrawCell: (data) => {
      // Dessin des cases carrées vides à cocher à la main pour Livré (col 6) et Encaissé (col 7)
      if (data.section === 'body' && (data.column.index === 6 || data.column.index === 7)) {
        const boxSize = 4.2;
        const boxX = data.cell.x + (data.cell.width - boxSize) / 2;
        const boxY = data.cell.y + (data.cell.height - boxSize) / 2;
        doc.setDrawColor(148, 163, 184); // #94A3B8
        doc.setLineWidth(0.25);
        doc.rect(boxX, boxY, boxSize, boxSize);
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 40;

  // Vérifier si l'espace restant sur la page est suffisant pour le bloc Remarques (18 mm) + Pied et signatures (38 mm) = 56 mm
  let bottomY = finalY + 4;
  if (bottomY + 56 > 280) {
    doc.addPage();
    bottomY = margin;
  }

  // 4. Bloc Remarques : cadre de 3 lignes à remplir à la main
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(27, 75, 74);
  doc.text('REMARQUES & INCIDENTS (à remplir à la main) :', margin, bottomY + 2.5);

  const remarksBoxY = bottomY + 4;
  const remarksHeight = 15;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.rect(margin, remarksBoxY, contentWidth, remarksHeight);

  // 3 lignes d'écriture guidée légères
  doc.setDrawColor(226, 232, 240);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin + 2, remarksBoxY + 5, margin + contentWidth - 2, remarksBoxY + 5);
  doc.line(margin + 2, remarksBoxY + 10, margin + contentWidth - 2, remarksBoxY + 10);
  doc.setLineDashPattern([], 0);

  bottomY = remarksBoxY + remarksHeight + 4;

  // 5. Pied : arrêts, total des commandes, À encaisser
  const summaryH = 11;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, bottomY, contentWidth, summaryH, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Arrêts :', margin + 4, bottomY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${orders.length}`, margin + 18, bottomY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Total des commandes :', margin + 38, bottomY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(27, 75, 74);
  doc.text(formatAmount(totalOrdersAmount, business.currency), margin + 74, bottomY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('À encaisser :', margin + 118, bottomY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 83, 9); // Ambre
  doc.text(formatAmount(toCollectAmount, business.currency), margin + 138, bottomY + 7);

  bottomY += summaryH + 4;

  // Deux cadres de signature identiques « Livreur » et « Responsable » (fond blanc, bordure grise fine, titre en gris foncé, une ligne « Date et heure »)
  const sigBoxW = (contentWidth - 6) / 2; // 88 mm chacun
  const sigBoxH = 18;

  // Cadre Signature Livreur : réinitialisation explicite de la couleur de fond, de bordure et du mode de dessin
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([], 0);
  doc.roundedRect(margin, bottomY, sigBoxW, sigBoxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85); // Titre gris foncé
  doc.text('SIGNATURE DU LIVREUR', margin + 3, bottomY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Date et heure : _____/_____/_________ à ____:____', margin + 3, bottomY + sigBoxH - 2.5);

  // Cadre Signature Responsable : réinitialisation explicite de la couleur de fond, de bordure et du mode de dessin
  const sigRightX = margin + sigBoxW + 6;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([], 0);
  doc.roundedRect(sigRightX, bottomY, sigBoxW, sigBoxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85); // Titre gris foncé
  doc.text('SIGNATURE DU RESPONSABLE', sigRightX + 3, bottomY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Date et heure : _____/_____/_________ à ____:____', sigRightX + 3, bottomY + sigBoxH - 2.5);

  // Pagination « Page n / n » et pied discret sur toutes les pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // #94A3B8
    doc.text(`Page ${p} / ${totalPages}`, pageWidth - margin, 292, { align: 'right' });
    doc.text(`Feuille de route · ${driver.name} · ${routeNumber}`, margin, 292);
  }

  return doc;
}

/**
 * 2. Génération et téléchargement du PDF de la Feuille de route A4.
 * Nom de fichier : feuille_de_route_<livreur>_<AAAA-MM-JJ>.pdf
 */
export async function generateRoutePdf(
  driver: Driver,
  orders: Order[],
  itemsByOrder: Record<string, OrderItem[]>,
  business: Business
): Promise<void> {
  const doc = await buildRouteDoc(driver, orders, itemsByOrder, business);
  const cleanDriver = driver.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const filename = `feuille_de_route_${cleanDriver}_${yyyy}-${mm}-${dd}.pdf`;
  openOrDownloadPdf(doc, filename);
}

export interface TicketPrintOptions {
  showClientPhone?: boolean;
  showAddress?: boolean;
  showDriver?: boolean;
  showFooter?: boolean;
}

/**
 * Rendu épuré d'un ticket thermique 80 mm (sans colonne de libellés).
 * - Nom du commerce 10 pt gras, centré
 * - Téléphone : libellé « Tél » à gauche (x=5) en 7,5 pt gris, numéro aligné à droite (x=75) en 9 pt
 * - Valeurs 9 pt
 * - Libellés (Nom, Tél, Adresse, Paiement, Livreur, Frais de livraison) 7,5 pt en gris
 * - Date 7,5 pt en gris
 * - TOTAL 11,5 pt gras avec filet
 * - Interligne 5 mm
 * - 4 mm au-dessus et au-dessous de chaque séparateur pointillé
 * - 2,5 mm entre deux articles
 * - 2 mm avant le filet du TOTAL
 * - Hauteur de page = hauteur mesurée + 8 mm
 */
function renderTicketContent(
  doc: jsPDF,
  ord: Order,
  items: OrderItem[],
  driver: Driver,
  business: Business,
  options?: TicketPrintOptions
): number {
  const ticketWidth = 80;
  const marginX = 5;
  const maxX = 75;
  const contentWidth = maxX - marginX; // 70 mm
  const lineHeight = 5.0; // Interligne de 5 mm
  const {
    showClientPhone = true,
    showAddress = true,
    showDriver = true,
    showFooter = true,
  } = options || {};

  let y = 6;

  // Séparateur pointillé : 4 mm au-dessus et 4 mm au-dessous
  const drawBlockSeparator = () => {
    y += 4.0; // 4 mm au-dessus
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(marginX, y, maxX, y);
    doc.setLineDashPattern([], 0);
    y += 4.0; // 4 mm au-dessous
  };

  // 1. En-tête : nom du commerce centré en 10 pt gras
  const legalName = business.config?.invoice?.legal_name || business.name || 'Commerce';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const nameLines = doc.splitTextToSize(legalName, contentWidth);
  doc.text(nameLines, ticketWidth / 2, y, { align: 'center' });
  y += nameLines.length * lineHeight;

  // Dessous, une ligne avec « Tél » en gris à gauche (x = 5) et le numéro du commerce aligné à droite (x = 75)
  const businessPhone = business.config?.invoice?.phone || business.whatsapp_number;
  if (businessPhone && businessPhone.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Tél', marginX, y);

    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(businessPhone.trim(), maxX, y, { align: 'right' });
    y += lineHeight;
  }

  // Adresse du commerce et identifiant fiscal seulement s'ils sont renseignés dans config.invoice
  const bAddress = business.config?.invoice?.address;
  if (bAddress && bAddress.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const bAddrLines = doc.splitTextToSize(bAddress.trim(), contentWidth);
    doc.text(bAddrLines, ticketWidth / 2, y, { align: 'center' });
    y += bAddrLines.length * 4.2;
  }

  const taxId = business.config?.invoice?.tax_id;
  if (taxId && taxId.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const taxLines = doc.splitTextToSize(`NINEA / RC : ${taxId.trim()}`, contentWidth);
    doc.text(taxLines, ticketWidth / 2, y, { align: 'center' });
    y += taxLines.length * 4.2;
  }

  // 2. Séparateur pointillé. Une ligne : « #réf » en gras à gauche et « date heure » à droite.
  drawBlockSeparator();

  const refShort = getOrderShortRef(ord);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`#${refShort}`, marginX, y);

  const orderDate = new Date(ord.created_at);
  const dateFormatted = !isNaN(orderDate.getTime())
    ? `${String(orderDate.getDate()).padStart(2, '0')}/${String(orderDate.getMonth() + 1).padStart(2, '0')}/${orderDate.getFullYear()} ${String(orderDate.getHours()).padStart(2, '0')}:${String(orderDate.getMinutes()).padStart(2, '0')}`
    : 'Date non renseignée';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(dateFormatted, maxX, y, { align: 'right' });
  y += lineHeight;

  // 3. Séparateur. Bloc client :
  // « Nom : valeur » (libellé gris 7,5 pt, valeur en gras 9 pt)
  // « Tél : valeur » (omise s'il n'y a pas de numéro)
  // « Adresse : valeur » avec retour à la ligne et alignement des lignes suivantes sous la valeur
  // Si le client est inconnu : « Nom : Client anonyme »
  // Commande à emporter (order_type = pickup) : « Retrait : sur place » à la place de l'adresse
  drawBlockSeparator();

  // Ligne 1 : Nom (libellé gris 7,5 pt, valeur en gras 9 pt)
  const rawName = (ord.customer_name || '').trim();
  const clientName = rawName || 'Client anonyme';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const nameLabel = 'Nom : ';
  const nameLabelWidth = doc.getTextWidth(nameLabel);
  doc.text(nameLabel, marginX, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const clientNameLines = doc.splitTextToSize(clientName, maxX - (marginX + nameLabelWidth));
  doc.text(clientNameLines, marginX + nameLabelWidth, y);
  y += Math.max(1, clientNameLines.length) * lineHeight;

  // Ligne 2 : Tél (omise s'il n'y a pas de numéro)
  if (showClientPhone && ord.customer_phone && ord.customer_phone.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const phoneLabel = 'Tél : ';
    const phoneLabelWidth = doc.getTextWidth(phoneLabel);
    doc.text(phoneLabel, marginX, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const phoneVal = ord.customer_phone.trim();
    const phoneLines = doc.splitTextToSize(phoneVal, maxX - (marginX + phoneLabelWidth));
    doc.text(phoneLines, marginX + phoneLabelWidth, y);
    y += Math.max(1, phoneLines.length) * lineHeight;
  }

  // Ligne 3 : Adresse avec retour à la ligne et alignement des lignes suivantes sous la valeur
  const isPickup = ord.order_type === 'pickup';
  if (showAddress) {
    const addressLabel = isPickup ? 'Retrait : ' : 'Adresse : ';
    const addressValue = isPickup ? 'sur place' : (ord.delivery_address || '').trim();

    if (addressValue) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const addrLabelWidth = doc.getTextWidth(addressLabel);
      doc.text(addressLabel, marginX, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const addrLines = doc.splitTextToSize(addressValue, maxX - (marginX + addrLabelWidth));
      doc.text(addrLines, marginX + addrLabelWidth, y);
      y += Math.max(1, addrLines.length) * lineHeight;
    }
  }

  // 4. Séparateur. Articles : « 1 x Yassa poulet braisé » avec le montant aligné à droite à x = 75 mm, 2,5 mm entre articles.
  drawBlockSeparator();

  if (items.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Aucun article', marginX, y);
    y += lineHeight;
  } else {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const qty = it.quantity || 1;
      const unitPrice = Number(it.unit_price || 0);
      const lineTotal = qty * unitPrice;
      const linePriceStr = formatAmount(lineTotal, business.currency);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);

      // Montant aligné à droite à x = 75 mm
      doc.text(linePriceStr, maxX, y, { align: 'right' });

      // « 1 x Yassa poulet braisé »
      const itemTitle = `${qty} x ${it.product_name || 'Article'}`;
      const priceWidth = doc.getTextWidth(linePriceStr);
      const maxTitleWidth = Math.max(25, contentWidth - priceWidth - 2);
      const titleLines = doc.splitTextToSize(itemTitle, maxTitleWidth);
      doc.text(titleLines, marginX, y);

      // 2,5 mm d'espace entre articles
      y += Math.max(1, titleLines.length) * lineHeight + 2.5;
    }
  }

  // 5. Séparateur. Frais de livraison et supplément urgent seulement s'ils sont supérieurs à 0, une ligne chacun ;
  // pas de « Sous-total » ; une ligne « Ajustement » seulement si la somme ne correspond pas au total ;
  // 2 mm d'espace avant le TOTAL, puis TOTAL en gras 11,5 pt avec un filet au-dessus.
  drawBlockSeparator();

  const deliveryFee = Number(ord.delivery_fee || 0);
  if (deliveryFee > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Frais de livraison', marginX, y);
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(formatAmount(deliveryFee, business.currency), maxX, y, { align: 'right' });
    y += lineHeight;
  }

  const urgentFee = Number(ord.urgent_surcharge_applied || 0);
  if (urgentFee > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Supplément urgent', marginX, y);
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(formatAmount(urgentFee, business.currency), maxX, y, { align: 'right' });
    y += lineHeight;
  }

  const itemsSum = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
    0
  );
  const totalAmount = Number(ord.total_amount || 0);
  const computedSum = itemsSum + (deliveryFee > 0 ? deliveryFee : 0) + (urgentFee > 0 ? urgentFee : 0);
  const diff = totalAmount - computedSum;
  if (Math.abs(diff) >= 0.5) {
    const diffSign = diff > 0 ? '+' : '';
    const diffStr = `${diffSign}${formatAmount(diff, business.currency)}`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Ajustement', marginX, y);
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(diffStr, maxX, y, { align: 'right' });
    y += lineHeight;
  }

  // 2 mm d'espace avant le TOTAL
  y += 2.0;

  // Filet au-dessus du TOTAL
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.35);
  doc.line(marginX, y, maxX, y);
  doc.setLineWidth(0.2);
  y += 4.5;

  // TOTAL en gras 11,5 pt
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL', marginX, y);
  doc.text(formatAmount(totalAmount, business.currency), maxX, y, { align: 'right' });
  y += 5.5;

  // 6. Séparateur. Deux lignes : « Paiement : … » et « Livreur : … »
  drawBlockSeparator();

  const pMethod = getPaymentMethodLabel(ord.payment_method);
  const pStatus = getPaymentStatusLabel(ord.payment_status);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const payLabel = 'Paiement : ';
  const payLabelWidth = doc.getTextWidth(payLabel);
  doc.text(payLabel, marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const paymentVal = `${pMethod} (${pStatus})`;
  const paymentLines = doc.splitTextToSize(paymentVal, maxX - (marginX + payLabelWidth));
  doc.text(paymentLines, marginX + payLabelWidth, y);
  y += Math.max(1, paymentLines.length) * lineHeight;

  if (showDriver && driver && driver.name) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const driverLabel = 'Livreur : ';
    const driverLabelWidth = doc.getTextWidth(driverLabel);
    doc.text(driverLabel, marginX, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const driverPhoneText = driver.phone ? ` · ${driver.phone}` : '';
    const driverVal = `${driver.name}${driverPhoneText}`;
    const driverLines = doc.splitTextToSize(driverVal, maxX - (marginX + driverLabelWidth));
    doc.text(driverLines, marginX + driverLabelWidth, y);
    y += Math.max(1, driverLines.length) * lineHeight;
  }

  // 7. Pied de page centré en italique 7,5 pt, seulement s'il est renseigné.
  const footerText = business.config?.invoice?.footer_text;
  if (showFooter && footerText && footerText.trim()) {
    drawBlockSeparator();
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const footerLines = doc.splitTextToSize(footerText.trim(), contentWidth);
    doc.text(footerLines, ticketWidth / 2, y, { align: 'center' });
    y += footerLines.length * 4.0;
  }

  return y;
}

/**
 * Première passe de dessin à blanc (sur un document temporaire) pour obtenir la hauteur réelle du contenu.
 */
function measureTicketContentHeight(
  ord: Order,
  items: OrderItem[],
  driver: Driver,
  business: Business,
  options?: TicketPrintOptions
): number {
  // Document temporaire à blanc avec une hauteur arbitrairement grande pour mesurer sans coupure de page
  const dummyDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 2000] });
  return renderTicketContent(dummyDoc, ord, items, driver, business, options);
}

/**
 * 2. Génération des tickets thermiques 80 mm.
 * Hauteur mesurée en deux passes : dessin à blanc puis création de la page à hauteur réelle + 8 mm.
 * Aucune zone vide en bas.
 * Largeur garantie à 80 mm et hauteur personnalisée par page avec doc.addPage([80, h], 'portrait').
 */
export async function generateTicketsPdf(
  orders: Order[],
  itemsByOrder: Record<string, OrderItem[]>,
  driver: Driver,
  business: Business,
  options?: TicketPrintOptions
): Promise<void> {
  if (orders.length === 0) return;

  const ticketWidth = 80;

  // 1ère passe (à blanc) sur le premier ticket pour dimensionner la première page
  const firstItems = itemsByOrder[orders[0].id] || [];
  const firstMeasuredY = measureTicketContentHeight(
    orders[0],
    firstItems,
    driver,
    business,
    options
  );
  // Hauteur de page = hauteur mesurée + 8 mm, sans zone vide
  const firstPageHeight = Math.ceil(firstMeasuredY + 8);

  // Création du document avec la hauteur réelle mesurée + 8 mm en orientation portrait explicite
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [ticketWidth, firstPageHeight],
  });

  // 2ème passe : rendu réel sur la première page
  renderTicketContent(doc, orders[0], firstItems, driver, business, options);

  // Tickets suivants
  for (let idx = 1; idx < orders.length; idx++) {
    const ord = orders[idx];
    const items = itemsByOrder[ord.id] || [];

    // 1ère passe (à blanc) : mesure de la hauteur exacte du contenu
    const measuredY = measureTicketContentHeight(
      ord,
      items,
      driver,
      business,
      options
    );
    // Hauteur de page = hauteur mesurée + 8 mm, sans zone vide
    const pageHeight = Math.ceil(measuredY + 8);

    // Création de la page avec doc.addPage([80, h], 'portrait') explicitement
    doc.addPage([ticketWidth, pageHeight], 'portrait');

    // 2ème passe : rendu réel
    renderTicketContent(doc, ord, items, driver, business, options);
  }

  const cleanDriverFilename = driver.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  openOrDownloadPdf(doc, `tickets_${cleanDriverFilename}_${Date.now()}.pdf`);
}
