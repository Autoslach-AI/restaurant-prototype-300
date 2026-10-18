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

function getPaymentMethodLabel(method?: string | null): string {
  if (!method) return 'Non spécifié';
  const m = method.toLowerCase();
  if (m === 'wave') return 'Wave';
  if (m === 'orange_money' || m === 'orange') return 'Orange Money';
  if (m === 'cash' || m === 'especes' || m === 'espèces') return 'Espèces';
  if (m === 'card' || m === 'carte') return 'Carte bancaire';
  if (m === 'free') return 'Offert';
  return method;
}

function getPaymentStatusLabel(status?: string | null): string {
  if (!status) return 'À encaisser';
  const s = status.toLowerCase();
  if (s === 'paid') return 'Payé';
  if (s === 'pending') return 'En attente';
  if (s === 'failed') return 'Échoué';
  if (s === 'refunded') return 'Remboursé';
  return 'À encaisser';
}

function estimateTicketHeight(order: Order, items: OrderItem[], footerText?: string): number {
  let h = 34; // Nom commerce + contact + séparateur
  h += 20; // Réf + Date/Heure + Client
  if (order.customer_phone) h += 5;
  if (order.delivery_address) {
    const lines = Math.ceil((order.delivery_address.length || 1) / 30);
    h += lines * 4 + 2;
  }
  if (order.delivery_zone_name || order.delivery_zone_id) h += 5;
  h += 10; // Séparateur + En-tête Articles
  for (const it of items) {
    const nameLines = Math.ceil((it.product_name?.length || 1) / 22);
    h += Math.max(1, nameLines) * 4.5 + 2;
  }
  if (order.delivery_fee && Number(order.delivery_fee) > 0) h += 5;
  if (order.urgent_surcharge_applied && Number(order.urgent_surcharge_applied) > 0) h += 5;
  h += 12; // Séparateur + TOTAL
  h += 6; // Moyen de paiement
  h += 6; // Livreur
  if (footerText && footerText.trim()) {
    const footLines = Math.ceil(footerText.trim().length / 32);
    h += footLines * 4 + 6;
  }
  h += 16; // Marge basse de sécurité
  return Math.max(120, Math.ceil(h));
}

/**
 * 1. Génération du Bon de tournée A4 portrait en français.
 * Groupement des arrêts par zone, numérotation, totaux et signature.
 */
export async function generateRoutePdf(
  driver: Driver,
  orders: Order[],
  itemsByOrder: Record<string, OrderItem[]>,
  business: Business
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const margin = 14;
  let currentY = 14;

  // 1. En-tête : logo (config.invoice.logo_url) si disponible
  const logoDataUrl = await loadImageAsDataUrl(business.config?.invoice?.logo_url);
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, currentY, 26, 18);
    } catch {
      // Ignorer sans erreur si le format image ne convient pas
    }
  }

  const headerLeftX = logoDataUrl ? margin + 30 : margin;

  // Nom légal (sinon business.name) et téléphone
  const legalName = business.config?.invoice?.legal_name || business.name;
  const businessPhone = business.config?.invoice?.phone || business.whatsapp_number;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(27, 75, 74); // #1B4B4A
  doc.text(legalName, headerLeftX, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  if (businessPhone) {
    doc.text(`Tél : ${businessPhone}`, headerLeftX, currentY + 10);
  }

  // Titre « Bon de tournée » & date à droite
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text('BON DE TOURNÉE', pageWidth - margin, currentY + 5, { align: 'right' });

  const todayStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(
    todayStr.charAt(0).toUpperCase() + todayStr.slice(1),
    pageWidth - margin,
    currentY + 10,
    { align: 'right' }
  );

  currentY += 24;

  // Encadré livreur
  doc.setFillColor(250, 247, 242); // #FAF7F2
  doc.setDrawColor(229, 220, 208); // #E5DCD0
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 12, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(27, 75, 74);
  const driverPhoneText = driver.phone ? ` · Tél : ${driver.phone}` : '';
  const driverNeighborhoodText = driver.neighborhood ? ` · Quartier : ${driver.neighborhood}` : '';
  doc.text(
    `Livreur : ${driver.name}${driverPhoneText}${driverNeighborhoodText}`,
    margin + 4,
    currentY + 7.5
  );

  currentY += 16;

  // 2. Groupement des arrêts par zone
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

  // Construction du corps du tableau avec arrêts groupés et numérotés
  const tableRows: any[] = [];
  let stopNumber = 1;

  for (const group of zonesList) {
    // Ligne d'en-tête de zone
    tableRows.push([
      {
        content: `ZONE : ${group.zoneName.toUpperCase()} (${group.orders.length} arrêt${group.orders.length > 1 ? 's' : ''})`,
        colSpan: 7,
        styles: {
          fillColor: [245, 242, 236],
          textColor: [27, 75, 74],
          fontStyle: 'bold',
          fontSize: 8.5,
          cellPadding: 2.5,
        },
      },
    ]);

    for (const ord of group.orders) {
      const refShort = ord.id.replace('order_', '').slice(0, 6);
      const items = itemsByOrder[ord.id] || [];
      const itemsSummary =
        items.length > 0
          ? items.map((it) => `${it.quantity} x ${it.product_name}`).join('\n')
          : 'Articles non spécifiés';

      const clientText = `${ord.customer_name || 'Client anonyme'}\n#${refShort}`;
      const phoneText = ord.customer_phone || '—';
      const addressText = ord.delivery_address || 'Adresse non renseignée';

      const paymentMethod = getPaymentMethodLabel(ord.payment_method);
      const paymentStatus = getPaymentStatusLabel(ord.payment_status);
      const paymentInfo = `${paymentMethod}\n(${paymentStatus})`;

      const amountFormatted = formatAmount(ord.total_amount, business.currency);

      tableRows.push([
        String(stopNumber),
        clientText,
        phoneText,
        addressText,
        itemsSummary,
        paymentInfo,
        amountFormatted,
      ]);

      stopNumber++;
    }
  }

  autoTable(doc, {
    startY: currentY,
    head: [
      ['N°', 'Client', 'Téléphone', 'Adresse de livraison', 'Articles / Plats', 'Paiement', 'Montant'],
    ],
    body: tableRows,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [229, 220, 208],
      lineWidth: 0.15,
      valign: 'top',
    },
    headStyles: {
      fillColor: [27, 75, 74],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 28 },
      2: { cellWidth: 24 },
      3: { cellWidth: 38 },
      4: { cellWidth: 40 },
      5: { cellWidth: 22, fontSize: 7.5 },
      6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 40;

  // 3. Pied de page : nombre d'arrêts, total des commandes, à encaisser et signature
  let summaryY = finalY + 8;
  if (summaryY > 240) {
    doc.addPage();
    summaryY = 16;
  }

  const totalOrdersAmount = orders.reduce(
    (sum, o) => sum + Number(o.total_amount || 0),
    0
  );
  const toCollectAmount = orders
    .filter((o) => o.payment_status !== 'paid')
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  // Bloc récapitulatif
  doc.setFillColor(250, 247, 242);
  doc.setDrawColor(229, 220, 208);
  doc.roundedRect(margin, summaryY, pageWidth - margin * 2, 28, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  doc.text(`Nombre d'arrêts : ${orders.length}`, margin + 5, summaryY + 8);
  doc.text(
    `Total des commandes : ${formatAmount(totalOrdersAmount, business.currency)}`,
    margin + 5,
    summaryY + 16
  );

  doc.setTextColor(180, 83, 9); // Ambre pour "À encaisser"
  doc.text(
    `À encaisser : ${formatAmount(toCollectAmount, business.currency)}`,
    margin + 5,
    summaryY + 24
  );

  // Espace Signature du livreur
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Signature du livreur :', pageWidth - margin - 55, summaryY + 8);
  doc.setDrawColor(180, 180, 180);
  doc.line(pageWidth - margin - 55, summaryY + 24, pageWidth - margin - 5, summaryY + 24);

  const cleanDriverFilename = driver.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  openOrDownloadPdf(doc, `bon_tournee_${cleanDriverFilename}_${Date.now()}.pdf`);
}

/**
 * 2. Génération des tickets thermiques 80 mm (1 ticket par page, hauteur calculée selon contenu).
 */
export async function generateTicketsPdf(
  orders: Order[],
  itemsByOrder: Record<string, OrderItem[]>,
  driver: Driver,
  business: Business
): Promise<void> {
  if (orders.length === 0) return;

  const ticketWidth = 80;
  const marginX = 5;
  const contentWidth = ticketWidth - marginX * 2; // 70 mm
  const footerText = business.config?.invoice?.footer_text;

  // Calcul de la hauteur de chaque commande
  const firstHeight = estimateTicketHeight(orders[0], itemsByOrder[orders[0].id] || [], footerText);
  const doc = new jsPDF({ unit: 'mm', format: [ticketWidth, firstHeight] });

  for (let idx = 0; idx < orders.length; idx++) {
    const ord = orders[idx];
    const items = itemsByOrder[ord.id] || [];

    if (idx > 0) {
      const pageHeight = estimateTicketHeight(ord, items, footerText);
      doc.addPage([ticketWidth, pageHeight]);
    }

    let y = 7;

    // Nom du commerce
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(27, 75, 74);
    doc.text(business.name, ticketWidth / 2, y, { align: 'center' });
    y += 5;

    // Téléphone du commerce si présent
    const businessPhone = business.config?.invoice?.phone || business.whatsapp_number;
    if (businessPhone) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(`Tél : ${businessPhone}`, ticketWidth / 2, y, { align: 'center' });
      y += 4;
    }

    // Séparateur pointillé
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(marginX, y, ticketWidth - marginX, y);
    doc.setLineDashPattern([], 0);
    y += 4.5;

    // Réf courte & date et heure
    const refShort = ord.id.replace('order_', '').slice(0, 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Commande #${refShort}`, marginX, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    const orderDate = new Date(ord.created_at);
    const dateFormatted = !isNaN(orderDate.getTime())
      ? `${String(orderDate.getDate()).padStart(2, '0')}/${String(orderDate.getMonth() + 1).padStart(2, '0')}/${orderDate.getFullYear()} à ${String(orderDate.getHours()).padStart(2, '0')}:${String(orderDate.getMinutes()).padStart(2, '0')}`
      : 'Date non renseignée';
    doc.text(`Date : ${dateFormatted}`, marginX, y);
    y += 4.5;

    // Client & téléphone (omission si vide)
    doc.setFont('helvetica', 'bold');
    doc.text(`Client : ${ord.customer_name || 'Client anonyme'}`, marginX, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    if (ord.customer_phone) {
      doc.text(`Tél : ${ord.customer_phone}`, marginX, y);
      y += 4;
    }

    // Adresse de livraison (omission si vide)
    if (ord.delivery_address) {
      const addressLines = doc.splitTextToSize(`Adresse : ${ord.delivery_address}`, contentWidth);
      doc.text(addressLines, marginX, y);
      y += addressLines.length * 3.8;
    }

    // Zone (omission si vide)
    const zoneName = ord.delivery_zone_name || ord.delivery_zone_id;
    if (zoneName && zoneName !== '__no_zone__') {
      doc.text(`Zone : ${zoneName}`, marginX, y);
      y += 4;
    }

    // Séparateur
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(marginX, y, ticketWidth - marginX, y);
    doc.setLineDashPattern([], 0);
    y += 4;

    // Liste des plats avec quantités et prix
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(27, 75, 74);
    doc.text('ARTICLES', marginX, y);
    doc.text('PRIX', ticketWidth - marginX, y, { align: 'right' });
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);

    if (items.length === 0) {
      doc.text('Aucun détail d\'article', marginX, y);
      y += 4;
    } else {
      for (const it of items) {
        const linePrice = formatAmount(it.quantity * it.unit_price, business.currency);
        const itemTitle = `${it.quantity} x ${it.product_name}`;
        const itemLines = doc.splitTextToSize(itemTitle, contentWidth - 22);

        doc.text(itemLines, marginX, y);
        doc.text(linePrice, ticketWidth - marginX, y, { align: 'right' });
        y += Math.max(1, itemLines.length) * 3.8 + 1;
      }
    }

    // Frais de livraison (si > 0)
    if (ord.delivery_fee && Number(ord.delivery_fee) > 0) {
      doc.text('Frais de livraison', marginX, y);
      doc.text(formatAmount(ord.delivery_fee, business.currency), ticketWidth - marginX, y, {
        align: 'right',
      });
      y += 4;
    }

    // Supplément urgent (si > 0)
    if (ord.urgent_surcharge_applied && Number(ord.urgent_surcharge_applied) > 0) {
      doc.text('Supplément urgent', marginX, y);
      doc.text(
        formatAmount(ord.urgent_surcharge_applied, business.currency),
        ticketWidth - marginX,
        y,
        { align: 'right' }
      );
      y += 4;
    }

    // Séparateur
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(marginX, y, ticketWidth - marginX, y);
    doc.setLineDashPattern([], 0);
    y += 4.5;

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL', marginX, y);
    doc.text(formatAmount(ord.total_amount, business.currency), ticketWidth - marginX, y, {
      align: 'right',
    });
    y += 5;

    // Moyen de paiement et statut
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    const pMethod = getPaymentMethodLabel(ord.payment_method);
    const pStatus = getPaymentStatusLabel(ord.payment_status);
    doc.text(`Paiement : ${pMethod} (${pStatus})`, marginX, y);
    y += 4;

    // Livreur
    const driverPhoneText = driver.phone ? ` (${driver.phone})` : '';
    doc.text(`Livreur : ${driver.name}${driverPhoneText}`, marginX, y);
    y += 5;

    // Pied de page (config.invoice.footer_text) si renseigné
    if (footerText && footerText.trim()) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(110, 110, 110);
      const footerLines = doc.splitTextToSize(footerText.trim(), contentWidth);
      doc.text(footerLines, ticketWidth / 2, y, { align: 'center' });
    }
  }

  const cleanDriverFilename = driver.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  openOrDownloadPdf(doc, `tickets_${cleanDriverFilename}_${Date.now()}.pdf`);
}
