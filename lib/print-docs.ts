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

  // Calcul du bloc du bas ancré à 14 mm du bord inférieur (A4 : 297 mm de haut)
  const pageHeight = 297;
  const bottomMargin = 14;
  const blockBottomY = pageHeight - bottomMargin; // 283 mm (bas des cadres de signature)

  // 1. Cadres de signature : 30 mm de haut
  const sigBoxH = 30;
  const sigBoxW = (contentWidth - 6) / 2; // 88 mm chacun
  const sigBoxY = blockBottomY - sigBoxH; // 253 mm

  // 2. Totaux : 11 mm de haut
  const summaryH = 11;
  const summaryGap = 4;
  const summaryY = sigBoxY - summaryGap - summaryH; // 238 mm

  // 3. Cadre Remarques : 35 mm de haut
  const remarksHeight = 35;
  const remarksGap = 4;
  const remarksBoxY = summaryY - remarksGap - remarksHeight; // 199 mm
  const remarksTitleY = remarksBoxY - 2.5; // 196.5 mm
  const blockTopY = remarksBoxY - 6; // 193 mm (espace suffisant pour le titre)

  // Si le tableau se termine trop bas pour contenir le bloc, ajouter une page
  if (finalY + 4 > blockTopY) {
    doc.addPage();
  }

  // 4. Bloc Remarques : cadre de 35 mm avec 5 lignes pointillées
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(27, 75, 74);
  doc.text('REMARQUES & INCIDENTS (à remplir à la main) :', margin, remarksTitleY);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.rect(margin, remarksBoxY, contentWidth, remarksHeight);

  // 5 lignes pointillées d'écriture guidée
  doc.setDrawColor(226, 232, 240);
  doc.setLineDashPattern([1, 1], 0);
  const lineSpacing = remarksHeight / 6; // ~5.83 mm d'intervalle pour 5 lignes
  for (let l = 1; l <= 5; l++) {
    const lineY = remarksBoxY + l * lineSpacing;
    doc.line(margin + 2, lineY, margin + contentWidth - 2, lineY);
  }
  doc.setLineDashPattern([], 0);

  // 5. Pied : arrêts, total des commandes, À encaisser
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, summaryY, contentWidth, summaryH, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Arrêts :', margin + 4, summaryY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${orders.length}`, margin + 18, summaryY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Total des commandes :', margin + 38, summaryY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(27, 75, 74);
  doc.text(formatAmount(totalOrdersAmount, business.currency), margin + 74, summaryY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('À encaisser :', margin + 118, summaryY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 83, 9); // Ambre
  doc.text(formatAmount(toCollectAmount, business.currency), margin + 138, summaryY + 7);

  // Deux cadres de signature de 30 mm de haut avec la ligne « Date et heure » en bas
  // Cadre Signature Livreur
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([], 0);
  doc.roundedRect(margin, sigBoxY, sigBoxW, sigBoxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85); // Titre gris foncé
  doc.text('SIGNATURE DU LIVREUR', margin + 3, sigBoxY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Date et heure : _____/_____/_________ à ____:____', margin + 3, sigBoxY + sigBoxH - 3);

  // Cadre Signature Responsable
  const sigRightX = margin + sigBoxW + 6;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([], 0);
  doc.roundedRect(sigRightX, sigBoxY, sigBoxW, sigBoxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85); // Titre gris foncé
  doc.text('SIGNATURE DU RESPONSABLE', sigRightX + 3, sigBoxY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Date et heure : _____/_____/_________ à ____:____', sigRightX + 3, sigBoxY + sigBoxH - 3);

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

export interface InvoicePrintOptions {
  showLogo?: boolean;
  showTaxId?: boolean;
  showFooter?: boolean;
  // Modifications temporaires avant impression (ne changent pas la commande en base)
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  subjectNote?: string;
  paymentMention?: string;
  dueDate?: string;
  footerText?: string;
}

/**
 * Construction du document jsPDF de la Facture A4 portrait.
 * Thème sobre (vert #1B4B4A, gris clair), marges 14 mm :
 * - En-tête : logo (config.invoice.logo_url), nom légal (sinon business.name),
 *   adresse, téléphone, identifiant fiscal (config.invoice.tax_id) ; une ligne vide est omise.
 *   À droite : « FACTURE », « N° <référence courte> », date de la commande, et date de livraison si elle existe.
 * - Bloc Client : nom (« Client anonyme » si inconnu), téléphone, adresse de livraison ou « Retrait sur place ».
 * - Tableau : Désignation | Qté | Prix unitaire | Total ligne.
 * - Totaux : Sous-total (somme des articles), Frais de livraison et Supplément urgent seulement si > 0,
 *   une ligne « Ajustement » si la somme ne correspond pas au total stocké, TOTAL en gras ;
 *   mention « Payée » ou « À régler » et moyen de paiement.
 * - Pied de page : config.invoice.footer_text. Pas de ligne de TVA.
 *   Commentaire dans le code : « Numérotation séquentielle et TVA à définir avec un comptable ».
 * - Options : showLogo, showTaxId, showFooter (activées par défaut).
 */
export async function buildInvoiceDoc(
  order: Order,
  items: OrderItem[],
  business: Business,
  options?: InvoicePrintOptions
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182 mm
  let currentY = 14;

  const showLogo = options?.showLogo ?? true;
  const showTaxId = options?.showTaxId ?? true;
  const showFooter = options?.showFooter ?? true;

  const currency = business.currency || 'XOF';
  const shortRef = getOrderShortRef(order);

  // 1. En-tête gauche : logo, nom légal, adresse, téléphone, identifiant fiscal
  const logoUrl = business.config?.invoice?.logo_url || business.logo_url;
  let logoDataUrl: string | null = null;
  if (showLogo) {
    logoDataUrl = await loadImageAsDataUrl(logoUrl);
  }

  let leftY = currentY;
  if (showLogo && logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, leftY, 24, 15);
      leftY += 18;
    } catch {
      // Ignoré sans erreur si format incompatible
    }
  }

  const legalName = business.config?.invoice?.legal_name || business.name || 'Commerce';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(27, 75, 74); // #1B4B4A
  doc.text(legalName, margin, leftY);
  leftY += 5;

  const address = business.config?.invoice?.address || business.address;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  if (address && address.trim()) {
    doc.text(address.trim(), margin, leftY);
    leftY += 4;
  }

  const phone = business.config?.invoice?.phone || business.whatsapp_number;
  if (phone && phone.trim()) {
    doc.text(`Tél : ${phone.trim()}`, margin, leftY);
    leftY += 4;
  }

  const taxId = business.config?.invoice?.tax_id;
  if (showTaxId && taxId && taxId.trim()) {
    doc.text(`NINEA / NIF : ${taxId.trim()}`, margin, leftY);
    leftY += 4;
  }

  // 2. En-tête droit : « FACTURE », « N° <réf> », date commande, date livraison si existante
  const rightX = pageWidth - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(27, 75, 74); // #1B4B4A
  doc.text('FACTURE', rightX, currentY + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`N° ${shortRef}`, rightX, currentY + 12, { align: 'right' });

  const orderDateStr = order.created_at
    ? new Date(order.created_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('fr-FR');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date : ${orderDateStr}`, rightX, currentY + 17, { align: 'right' });

  let rightY = currentY + 22;
  if (order.delivered_at) {
    const delivDateStr = new Date(order.delivered_at).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    doc.text(`Livrée le : ${delivDateStr}`, rightX, rightY, { align: 'right' });
    rightY += 5;
  }
  if (options?.dueDate && options.dueDate.trim()) {
    doc.text(`Échéance : ${options.dueDate.trim()}`, rightX, rightY, { align: 'right' });
    rightY += 5;
  }

  currentY = Math.max(leftY, rightY) + 5;

  // 3. Bloc Client : nom (« Client anonyme » si inconnu), téléphone, adresse de livraison ou « Retrait sur place »
  const clientBoxY = currentY;
  const clientName = (options?.customerName !== undefined ? options.customerName : order.customer_name)?.trim() || 'Client anonyme';
  const clientPhone = (options?.customerPhone !== undefined ? options.customerPhone : order.customer_phone)?.trim();
  const rawAddress = options?.customerAddress !== undefined
    ? options.customerAddress
    : (order.order_type === 'pickup' ? 'Retrait sur place' : order.delivery_address);
  const clientAddress = rawAddress?.trim() || 'Retrait sur place';

  doc.setFillColor(248, 250, 252); // #F8FAFC
  doc.setDrawColor(226, 232, 240); // #E2E8F0
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, clientBoxY, contentWidth, 20, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(27, 75, 74);
  doc.text('FACTURÉ À :', margin + 4, clientBoxY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(clientName, margin + 4, clientBoxY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  let subInfo = '';
  if (clientPhone) {
    subInfo += `Tél : ${clientPhone}`;
  }
  if (clientAddress) {
    if (subInfo) subInfo += '   ·   ';
    subInfo += `Adresse : ${clientAddress}`;
  }
  doc.text(subInfo, margin + 4, clientBoxY + 15);

  currentY = clientBoxY + 23;

  // Objet / note (200 caractères max) si renseigné
  if (options?.subjectNote && options.subjectNote.trim()) {
    const trimmedNote = options.subjectNote.trim().slice(0, 200);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, currentY, contentWidth, 10, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(27, 75, 74);
    doc.text('Objet / Note :', margin + 3, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    const noteLines = doc.splitTextToSize(trimmedNote, contentWidth - 26);
    doc.text(noteLines[0] || trimmedNote, margin + 23, currentY + 4.5);
    if (noteLines[1]) {
      doc.text(noteLines[1], margin + 23, currentY + 8);
    }
    currentY += 13;
  } else {
    currentY += 1;
  }

  // 4. Tableau : Désignation | Qté | Prix unitaire | Total ligne
  let subTotal = 0;
  const tableRows: string[][] = [];

  if (items && items.length > 0) {
    items.forEach((it) => {
      const qty = it.quantity || 1;
      const unitPrice = Number(it.unit_price) || 0;
      const lineTotal = unitPrice * qty;
      subTotal += lineTotal;
      tableRows.push([
        it.product_name || `Article`,
        qty.toString(),
        formatAmount(unitPrice, currency),
        formatAmount(lineTotal, currency),
      ]);
    });
  } else {
    // Si la commande n'a pas d'articles détaillés
    const fallbackTotal = Number(order.total_amount || 0);
    subTotal = fallbackTotal;
    tableRows.push([
      `Commande #${shortRef}`,
      '1',
      formatAmount(fallbackTotal, currency),
      formatAmount(fallbackTotal, currency),
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Désignation', 'Qté', 'Prix unitaire', 'Total ligne']],
    body: tableRows,
    theme: 'grid',
    margin: { left: margin, right: margin, top: 14, bottom: 18 },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [27, 75, 74], // #1B4B4A
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 92 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalTableY = (doc as any).lastAutoTable?.finalY || currentY + 30;

  // 5. Totaux : Sous-total, Frais livraison, Supplément urgent, Ajustement, TOTAL, mention Payée / À régler
  const deliveryFee = Number(order.delivery_fee || 0);
  const urgentFee = Number(order.urgent_surcharge_applied || 0);
  const totalStored = Number(order.total_amount || 0);
  const calculatedSum = subTotal + (deliveryFee > 0 ? deliveryFee : 0) + (urgentFee > 0 ? urgentFee : 0);
  const adjustment = totalStored - calculatedSum;

  let totY = finalTableY + 6;
  if (totY + 45 > 280) {
    doc.addPage();
    totY = margin;
  }

  const totalsXLabel = 120;
  const totalsXVal = pageWidth - margin;

  // Sous-total (somme des articles)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Sous-total :', totalsXLabel, totY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(formatAmount(subTotal, currency), totalsXVal, totY, { align: 'right' });
  totY += 5;

  // Frais de livraison seulement si > 0
  if (deliveryFee > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Frais de livraison :', totalsXLabel, totY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(formatAmount(deliveryFee, currency), totalsXVal, totY, { align: 'right' });
    totY += 5;
  }

  // Supplément urgent seulement si > 0
  if (urgentFee > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Supplément urgent :', totalsXLabel, totY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(formatAmount(urgentFee, currency), totalsXVal, totY, { align: 'right' });
    totY += 5;
  }

  // Ligne « Ajustement » si la somme ne correspond pas au total stocké
  if (Math.abs(adjustment) >= 1) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Ajustement :', totalsXLabel, totY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    const adjSign = adjustment > 0 ? '+' : '';
    doc.text(`${adjSign}${formatAmount(adjustment, currency)}`, totalsXVal, totY, { align: 'right' });
    totY += 5;
  }

  // Ligne de séparation avant TOTAL
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(totalsXLabel, totY, totalsXVal, totY);
  totY += 4.5;

  // TOTAL en gras
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(27, 75, 74); // #1B4B4A
  doc.text('TOTAL :', totalsXLabel, totY);
  doc.text(formatAmount(totalStored, currency), totalsXVal, totY, { align: 'right' });
  totY += 6.5;

  // Mention « Payée » ou « À régler » ou texte personnalisé
  const isPaid = order.payment_status === 'paid';
  const defaultPaymentMethod = getPaymentMethodLabel(order.payment_method);
  const defaultPaymentMention = isPaid ? `Payée · ${defaultPaymentMethod}` : `À régler · ${defaultPaymentMethod}`;
  const finalPaymentMention = options?.paymentMention && options.paymentMention.trim()
    ? options.paymentMention.trim()
    : defaultPaymentMention;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const lowerMention = finalPaymentMention.toLowerCase();
  if (lowerMention.includes('payé') || lowerMention.includes('payee') || isPaid) {
    doc.setTextColor(22, 101, 52); // vert
  } else {
    doc.setTextColor(180, 83, 9); // ambre
  }
  doc.text(finalPaymentMention, totalsXVal, totY, { align: 'right' });

  // Test de cohérence : mention personnalisée indiquant payé/payée alors que non paid, ou à régler alors que paid
  if (options?.paymentMention && options.paymentMention.trim()) {
    const customLower = options.paymentMention.trim().toLowerCase();
    const indicatesPaid =
      customLower.includes('payé') ||
      customLower.includes('payée') ||
      customLower.includes('paye') ||
      customLower.includes('payee');
    const indicatesToPay =
      customLower.includes('à régler') ||
      customLower.includes('a regler');

    const isConflict =
      (indicatesPaid && order.payment_status !== 'paid') ||
      (indicatesToPay && order.payment_status === 'paid');

    if (isConflict) {
      totY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // Gris
      doc.text('Mention modifiée avant impression', totalsXVal, totY, { align: 'right' });
    }
  }

  // 6. Pied de page : options.footerText si renseigné, sinon config.invoice.footer_text. Pas de ligne de TVA.
  // Numérotation séquentielle et TVA à définir avec un comptable
  const footerText = options?.footerText !== undefined
    ? options.footerText
    : business.config?.invoice?.footer_text;
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (showFooter && footerText && footerText.trim()) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const footerLines = doc.splitTextToSize(footerText.trim(), contentWidth);
      doc.text(footerLines, pageWidth / 2, 285, { align: 'center' });
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${p} / ${totalPages}`, pageWidth - margin, 292, { align: 'right' });
    doc.text(`Facture N° ${shortRef}`, margin, 292);
  }

  return doc;
}

/**
 * Génération et ouverture / téléchargement du PDF de la Facture A4.
 * Nom de fichier : facture_<référence>_<AAAA-MM-JJ>.pdf
 */
export async function generateInvoicePdf(
  order: Order,
  items: OrderItem[],
  business: Business,
  options?: InvoicePrintOptions
): Promise<void> {
  const doc = await buildInvoiceDoc(order, items, business, options);
  const shortRef = getOrderShortRef(order);
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const filename = `facture_${shortRef}_${yyyy}-${mm}-${dd}.pdf`;
  openOrDownloadPdf(doc, filename);
}

/**
 * Téléchargement direct du PDF de la Facture A4.
 * Nom de fichier : facture_<référence>_<AAAA-MM-JJ>.pdf
 */
export async function downloadInvoicePdf(
  order: Order,
  items: OrderItem[],
  business: Business,
  options?: InvoicePrintOptions
): Promise<void> {
  const doc = await buildInvoiceDoc(order, items, business, options);
  const shortRef = getOrderShortRef(order);
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const filename = `facture_${shortRef}_${yyyy}-${mm}-${dd}.pdf`;
  doc.save(filename);
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
