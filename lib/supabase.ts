import { createClient } from '@supabase/supabase-js';
import { AgentChatMessage, AgentChatMessageAttachment, AgentConversation, AgentProject, AttendanceRecord, Business, Category, Customer, CustomerMessage, DeliveryZone, Expense, ExpenseCategory, ExpenseCategoryItem, Order, OrderItem, OrderStatus, PaymentStatus, Product, Staff, StaffPermissions } from './types';
import { getStore } from './store';

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!url || !key) {
      throw new Error(
        'Configuration Supabase manquante : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être définis.'
      );
    }

    if (!url.startsWith('https://')) {
      throw new Error(
        'Configuration Supabase invalide : NEXT_PUBLIC_SUPABASE_URL doit commencer par "https://".'
      );
    }

    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string, unknown>)[prop as string];
  },
});

/**
 * Helper to convert Base64 Data URL to a Blob
 */
function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string } {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const byteString = atob(parts[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return { blob: new Blob([ab], { type: mime }), contentType: mime };
}

/**
 * Detects the normalized file extension and MIME type from a Blob/File or data URL.
 * Handles JPEG, PNG, WEBP, GIF, HEIC/HEIF, AVIF, SVG.
 */
function resolveImageMetadata(blobOrFile: Blob | File, customMime?: string): { mimeType: string; extension: string } {
  const mime = (customMime || blobOrFile.type || '').toLowerCase().trim();

  if (mime.includes('heic') || mime.includes('heif')) {
    return { mimeType: 'image/heic', extension: 'heic' };
  }
  if (mime.includes('png')) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (mime.includes('webp')) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  if (mime.includes('gif')) {
    return { mimeType: 'image/gif', extension: 'gif' };
  }
  if (mime.includes('svg')) {
    return { mimeType: 'image/svg+xml', extension: 'svg' };
  }
  if (mime.includes('avif')) {
    return { mimeType: 'image/avif', extension: 'avif' };
  }
  return { mimeType: 'image/jpeg', extension: 'jpg' };
}

/**
 * Uploads a product image to Supabase Storage bucket 'platform-product-images'.
 * 
 * Requirements:
 * 1. Sanitized unique storage path: `${businessId}/${Date.now()}_${random}.${ext}` (never uses raw user filename).
 * 2. Real content-type detection supporting JPEG, PNG, WEBP, GIF, HEIC/HEIF.
 * 3. 5MB max size limit check with clear error message.
 * 4. Returns public HTTPS URL.
 */
export async function uploadProductImage(
  input: File | Blob | string,
  businessId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  // If already an HTTP(S) URL, return it directly
  if (typeof input === 'string' && (input.startsWith('http://') || input.startsWith('https://'))) {
    return { success: true, url: input };
  }

  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

  let fileBlob: Blob;
  let detectedMime = 'image/jpeg';

  if (typeof input === 'string' && input.startsWith('data:')) {
    const parsed = dataUrlToBlob(input);
    fileBlob = parsed.blob;
    detectedMime = parsed.contentType;
  } else if (input instanceof File || input instanceof Blob) {
    fileBlob = input;
    detectedMime = input.type || 'image/jpeg';
  } else {
    return { success: false, error: 'Format d\'image non valide.' };
  }

  // Size verification (<= 5 Mo)
  if (fileBlob.size > MAX_SIZE_BYTES) {
    const actualMb = (fileBlob.size / (1024 * 1024)).toFixed(1);
    return {
      success: false,
      error: `L'image est trop volumineuse (${actualMb} Mo). La taille maximale autorisée est de 5 Mo.`,
    };
  }

  // Determine metadata
  const { mimeType, extension } = resolveImageMetadata(fileBlob, detectedMime);

  // Generate safe sanitized unique filename: Date.now()_random.ext (completely ignores user input name)
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const safeFileName = `${Date.now()}_${randomSuffix}.${extension}`;
  const cleanBusinessId = businessId ? businessId.replace(/[^a-zA-Z0-9_-]/g, '') : 'common';
  const filePath = `${cleanBusinessId}/${safeFileName}`;

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (hasCredentials) {
    try {
      const client = getSupabase();
      const BUCKET_NAME = 'platform-product-images';

      const uploadRes = await client.storage
        .from(BUCKET_NAME)
        .upload(filePath, fileBlob, {
          upsert: true,
          contentType: mimeType,
          cacheControl: '3600',
        });

      if (uploadRes.error) {
        console.error(`Upload to ${BUCKET_NAME} failed:`, uploadRes.error.message);
        return {
          success: false,
          error: `Échec de l'upload de l'image (${uploadRes.error.message})`,
        };
      }

      if (uploadRes.data) {
        const { data: publicUrlData } = client.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          return { success: true, url: publicUrlData.publicUrl };
        }
      }

      return { success: false, error: 'Impossible de récupérer l\'URL publique de l\'image.' };
    } catch (err: any) {
      console.error('Supabase storage uploadProductImage exception:', err);
      return { success: false, error: err?.message || 'Erreur lors de l\'upload de l\'image.' };
    }
  }

  // Fallback for local demo preview when Supabase is not connected
  try {
    if (typeof input === 'string') {
      return { success: true, url: input };
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Erreur de conversion de fichier'));
      };
      reader.onerror = () => reject(new Error('Erreur de lecture de l\'image'));
      reader.readAsDataURL(fileBlob);
    });
    return { success: true, url: dataUrl };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur locale de traitement d\'image.' };
  }
}

/**
 * Uploads a staff profile photo to Supabase Storage.
 * Uses the 'platform-staff-avatars' bucket with path '{businessId}/{fileName}'.
 * Handles File, Blob, and base64 Data URLs.
 * Returns public HTTPS URL.
 */
export async function uploadStaffAvatar(
  input: File | Blob | string,
  businessId: string
): Promise<string> {
  // If input is already an HTTP(S) URL, return it directly
  if (typeof input === 'string' && (input.startsWith('http://') || input.startsWith('https://'))) {
    return input;
  }

  let fileBlob: Blob;
  let contentType = 'image/jpeg';
  let fileExt = 'jpg';

  if (typeof input === 'string' && input.startsWith('data:')) {
    const parsed = dataUrlToBlob(input);
    fileBlob = parsed.blob;
    contentType = parsed.contentType;
    fileExt = contentType.split('/')[1] || 'jpg';
  } else if (input instanceof File) {
    fileBlob = input;
    contentType = input.type || 'image/jpeg';
    fileExt = input.name.split('.').pop() || 'jpg';
  } else if (input instanceof Blob) {
    fileBlob = input;
    contentType = input.type || 'image/jpeg';
    fileExt = contentType.split('/')[1] || 'jpg';
  } else {
    return '';
  }

  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
  const filePath = `${businessId}/${fileName}`;

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (hasCredentials) {
    try {
      const client = getSupabase();
      const BUCKET_NAME = 'platform-staff-avatars';

      const uploadRes = await client.storage
        .from(BUCKET_NAME)
        .upload(filePath, fileBlob, { upsert: true, contentType });

      if (uploadRes.error) {
        console.error(`Upload to ${BUCKET_NAME} failed:`, uploadRes.error.message);
        throw new Error(`Échec de l'upload de la photo: ${uploadRes.error.message}`);
      }

      if (uploadRes.data) {
        const { data: publicUrlData } = client.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
    } catch (err: any) {
      console.error('Supabase storage upload exception:', err);
      throw err;
    }
  }

  // Fallback to reading file as Data URL only if Supabase keys are absent
  if (typeof input === 'string') return input;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to Data URL'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading image file'));
    reader.readAsDataURL(fileBlob);
  });
}

/**
 * Fetch staff members for a business from platform_staff table in Supabase.
 * Returns array of Staff records (empty array if error or no records, never invented mock data).
 */
export async function fetchStaffForBusiness(businessId: string): Promise<Staff[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return [];
  }

  try {
    const client = getSupabase();
    const { data, error } = await (client as any)
      .from('platform_staff')
      .select('*')
      .eq('business_id', businessId);

    if (error) {
      console.warn('Supabase fetch staff error:', error.message);
      return [];
    }

    return (data as Staff[]) || [];
  } catch (err: any) {
    console.warn('Supabase fetch staff exception:', err?.message || err);
    return [];
  }
}

/**
 * Insert a new staff collaborator member into platform_staff in Supabase.
 * - Forces role to 'collaborator'
 * - Sets auth_uid to null
 * - Returns inserted Staff on success, or { success: false, error } on failure
 */
export async function insertStaffMember(data: {
  business_id: string;
  invited_by: string | null;
  name: string;
  email: string;
  phone?: string;
  role_title?: string;
  salary?: number | string;
  permissions: StaffPermissions;
  avatar_url?: string;
  photo_url?: string;
}): Promise<{ success: boolean; staff?: Staff; error?: string }> {
  const newId = `staff_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
  const now = new Date().toISOString();

  // If a photo was supplied as base64 Data URL, upload it to Supabase Storage first
  let resolvedAvatarUrl: string | null = null;
  const rawPhoto = data.avatar_url || data.photo_url;
  if (rawPhoto && rawPhoto.trim() !== '') {
    if (rawPhoto.startsWith('data:')) {
      try {
        resolvedAvatarUrl = await uploadStaffAvatar(rawPhoto, data.business_id);
      } catch (uploadErr) {
        console.warn('Error uploading staff avatar before insert:', uploadErr);
        resolvedAvatarUrl = null;
      }
    } else {
      resolvedAvatarUrl = rawPhoto.trim();
    }
  }

  const recordToInsert: any = {
    id: newId,
    business_id: data.business_id,
    auth_uid: null,
    name: data.name.trim(),
    email: data.email.trim(),
    phone: data.phone?.trim() || null,
    role_title: data.role_title?.trim() || 'Collaborateur',
    role: 'collaborator',
    salary: data.salary ? Number(data.salary) : null,
    permissions: data.permissions,
    invited_by: data.invited_by || null,
    created_at: now,
    avatar_url: resolvedAvatarUrl || null,
    photo_url: null, // Only avatar_url is stored; photo_url is kept NULL
  };

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const store = getStore();
    const localStaff = recordToInsert as Staff;
    store.addStaff(localStaff);
    return { success: true, staff: localStaff };
  }

  try {
    const client = getSupabase();
    const { data: insertedRows, error } = await (client as any)
      .from('platform_staff')
      .insert(recordToInsert)
      .select();

    if (error) {
      console.warn('Supabase insert staff error:', error.message);
      return { success: false, error: error.message };
    }

    if (!insertedRows || insertedRows.length === 0) {
      console.warn('Supabase insert staff: 0 rows returned');
      return { success: false, error: "L'insertion en base de données n'a retourné aucun enregistrement." };
    }

    const insertedStaff = insertedRows[0] as Staff;
    const store = getStore();
    store.addStaff(insertedStaff);

    return { success: true, staff: insertedStaff };
  } catch (err: any) {
    console.warn('Supabase insert staff exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * Revoke a staff member's access.
 * Updates platform_staff: SET revoked = true, revocation_reason = reason WHERE id = staffId AND role != 'owner'
 * Returns error if 0 rows updated or if owner.
 */
export async function revokeStaffMember(
  staffId: string,
  reason: string
): Promise<{ success: boolean; staff?: Staff; error?: string }> {
  const store = getStore();
  const target = store.staff.find((s) => s.id === staffId);
  if (target && target.role === 'owner') {
    return { success: false, error: 'Le rôle propriétaire (owner) ne peut jamais être révoqué.' };
  }

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.revokeStaff(staffId, reason);
    const updated = store.staff.find((s) => s.id === staffId);
    return { success: true, staff: updated };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_staff')
      .update({
        revoked: true,
        revocation_reason: reason.trim(),
      })
      .eq('id', staffId)
      .neq('role', 'owner')
      .select();

    if (error) {
      console.warn('Supabase revoke staff error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase revoke staff: 0 rows affected');
      return {
        success: false,
        error: "Aucun membre n'a été mis à jour (membre introuvable ou protégé).",
      };
    }

    store.revokeStaff(staffId, reason);
    return { success: true, staff: updatedRows[0] as Staff };
  } catch (err: any) {
    console.warn('Supabase revoke staff exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * Reactivate a previously revoked staff member.
 * Updates platform_staff: SET revoked = false, revocation_reason = NULL WHERE id = staffId
 * Returns error if 0 rows updated.
 */
export async function reactivateStaffMember(
  staffId: string
): Promise<{ success: boolean; staff?: Staff; error?: string }> {
  const store = getStore();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.reactivateStaff(staffId);
    const updated = store.staff.find((s) => s.id === staffId);
    return { success: true, staff: updated };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_staff')
      .update({
        revoked: false,
        revocation_reason: null,
      })
      .eq('id', staffId)
      .select();

    if (error) {
      console.warn('Supabase reactivate staff error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase reactivate staff: 0 rows affected');
      return {
        success: false,
        error: "Aucun membre n'a été réactivé (membre introuvable).",
      };
    }

    store.reactivateStaff(staffId);
    return { success: true, staff: updatedRows[0] as Staff };
  } catch (err: any) {
    console.warn('Supabase reactivate staff exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * Delete a staff member permanently.
 * Deletes from platform_staff: DELETE FROM platform_staff WHERE id = staffId AND role != 'owner'
 * Returns error if 0 rows deleted or if owner.
 */
export async function deleteStaffMember(
  staffId: string
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();
  const target = store.staff.find((s) => s.id === staffId);
  if (target && target.role === 'owner') {
    return { success: false, error: 'Le propriétaire (owner) ne peut jamais être supprimé.' };
  }

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.deleteStaff(staffId);
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: deletedRows, error } = await (client as any)
      .from('platform_staff')
      .delete()
      .eq('id', staffId)
      .neq('role', 'owner')
      .select();

    if (error) {
      console.warn('Supabase delete staff error:', error.message);
      return { success: false, error: error.message };
    }

    if (!deletedRows || deletedRows.length === 0) {
      console.warn('Supabase delete staff: 0 rows affected');
      return {
        success: false,
        error: "Aucun membre n'a été supprimé (membre introuvable ou protégé).",
      };
    }

    store.deleteStaff(staffId);
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase delete staff exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

export async function fetchAttendanceRecords(businessId: string, startDate?: string, endDate?: string): Promise<AttendanceRecord[]> {
  const store = getStore();
  const localRecords = store.getAttendanceRecords(businessId, startDate, endDate);

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return localRecords;
  }

  try {
    const client = getSupabase();
    let query = (client as any)
      .from('platform_attendance')
      .select('*')
      .eq('business_id', businessId);

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query.order('date', { ascending: false });
    if (error) {
      console.warn('Supabase fetch attendance error:', error.message);
      return localRecords;
    }
    const remoteRecords = (data as AttendanceRecord[]) || [];
    if (remoteRecords.length > 0) {
      remoteRecords.forEach((r) => store.upsertAttendanceRecord(r));
      return store.getAttendanceRecords(businessId, startDate, endDate);
    }
    return localRecords;
  } catch (err) {
    console.warn('Supabase fetch attendance exception:', err);
    return localRecords;
  }
}

export async function upsertAttendanceRecord(record: {
  business_id: string;
  staff_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  reason?: string | null;
}): Promise<AttendanceRecord | null> {
  const store = getStore();

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const isValidUrl = Boolean(rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')));
  const hasCredentials = isValidUrl && Boolean(rawKey);

  if (!hasCredentials) {
    return store.upsertAttendanceRecord(record);
  }

  try {
    const client = getSupabase();
    const { data, error } = await (client as any)
      .from('platform_attendance')
      .upsert(
        {
          business_id: record.business_id,
          staff_id: record.staff_id,
          date: record.date,
          status: record.status,
          reason: record.reason || null,
        },
        { onConflict: 'business_id,staff_id,date' }
      )
      .select()
      .single();

    if (error) {
      console.warn('Supabase upsert attendance error:', error.message);
      return null;
    }

    if (!data) {
      console.warn('Supabase upsert attendance: 0 rows affected / no data returned');
      return null;
    }

    store.upsertAttendanceRecord(data as AttendanceRecord);
    return data as AttendanceRecord;
  } catch (err) {
    console.warn('Supabase upsert attendance exception:', err);
    return null;
  }
}

export async function updateStaffProfile(
  staffId: string,
  auth_uid: string | undefined,
  data: { name?: string; email?: string; phone?: string; avatar_url?: string; photo_url?: string }
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();
  store.updateStaff(staffId, data);

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const isValidUrl = Boolean(rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')));
  const hasCredentials = isValidUrl && Boolean(rawKey);

  if (!hasCredentials) {
    return { success: true };
  }

  try {
    const client = getSupabase();
    let query = (client as any).from('platform_staff').update({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
    });

    if (auth_uid && !auth_uid.startsWith('auth-')) {
      query = query.or(`auth_uid.eq.${auth_uid},id.eq.${staffId}`);
    } else {
      query = query.eq('id', staffId);
    }

    const { data: updatedRows, error } = await query.select();
    if (error) {
      console.warn('Supabase update staff error:', error.message);
      return { success: false, error: error.message };
    }
    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase update staff: 0 rows affected (record not found in platform_staff)');
      return { success: false, error: 'Enregistrement introuvable en base de données' };
    }
    console.log('Supabase staff updated successfully:', updatedRows);
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase update staff exception:', err);
    return { success: false, error: err?.message || 'Erreur lors de la mise à jour' };
  }
}

export async function updateStaffNotificationPreferences(
  staffId: string,
  auth_uid: string | undefined,
  preferences: { email: boolean; whatsapp: boolean }
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();
  store.updateStaff(staffId, { notification_preferences: preferences });

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const isValidUrl = Boolean(rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')));
  const hasCredentials = isValidUrl && Boolean(rawKey);

  if (!hasCredentials) {
    return { success: true };
  }

  try {
    const client = getSupabase();
    let query = (client as any).from('platform_staff').update({
      notification_preferences: preferences,
    });

    if (auth_uid && !auth_uid.startsWith('auth-')) {
      query = query.or(`auth_uid.eq.${auth_uid},id.eq.${staffId}`);
    } else {
      query = query.eq('id', staffId);
    }

    const { data: updatedRows, error } = await query.select();
    if (error) {
      console.warn('Supabase update notification preferences error:', error.message);
      return { success: false, error: error.message };
    }
    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase update notification preferences: 0 rows affected (record not found in platform_staff)');
      return { success: false, error: 'Enregistrement introuvable en base de données' };
    }
    console.log('Supabase staff notification preferences updated:', updatedRows);
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase update notification preferences exception:', err);
    return { success: false, error: err?.message || 'Erreur de connexion' };
  }
}

/**
 * ============================================================================
 * CATEGORIES CRUD (platform_categories)
 * ============================================================================
 */

/**
 * Fetch categories for a business from platform_categories in Supabase.
 * Returns empty array if error or no credentials (no invented data).
 */
export async function fetchCategoriesForBusiness(businessId: string): Promise<Category[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return [];
  }

  try {
    const client = getSupabase();
    const { data, error } = await (client as any)
      .from('platform_categories')
      .select('*')
      .eq('business_id', businessId)
      .order('display_order', { ascending: true });

    if (error) {
      console.warn('Supabase fetch categories error:', error.message);
      return [];
    }

    return (data as Category[]) || [];
  } catch (err: any) {
    console.warn('Supabase fetch categories exception:', err?.message || err);
    return [];
  }
}

/**
 * Insert a category into platform_categories in Supabase.
 */
export async function insertCategory(data: {
  business_id: string;
  name: string;
  display_order?: number;
}): Promise<{ success: boolean; category?: Category; error?: string }> {
  const store = getStore();
  const currentCats = store.categories.filter((c) => c.business_id === data.business_id);
  const displayOrder = data.display_order ?? (currentCats.length + 1);
  const newId = `cat_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;

  const recordToInsert = {
    id: newId,
    business_id: data.business_id,
    name: data.name.trim(),
    display_order: displayOrder,
  };

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.addCategoryLocally(recordToInsert);
    return { success: true, category: recordToInsert };
  }

  try {
    const client = getSupabase();
    const { data: insertedRows, error } = await (client as any)
      .from('platform_categories')
      .insert(recordToInsert)
      .select();

    if (error) {
      console.warn('Supabase insert category error:', error.message);
      return { success: false, error: error.message };
    }

    if (!insertedRows || insertedRows.length === 0) {
      console.warn('Supabase insert category: 0 rows returned');
      return { success: false, error: "L'insertion de la catégorie n'a retourné aucun enregistrement." };
    }

    const insertedCat = insertedRows[0] as Category;
    store.addCategoryLocally(insertedCat);
    return { success: true, category: insertedCat };
  } catch (err: any) {
    console.warn('Supabase insert category exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * Update a category in platform_categories in Supabase.
 */
export async function updateCategory(
  categoryId: string,
  data: Partial<Omit<Category, 'id' | 'business_id'>>
): Promise<{ success: boolean; category?: Category; error?: string }> {
  const store = getStore();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.updateCategoryLocally(categoryId, data);
    const updated = store.categories.find((c) => c.id === categoryId);
    return { success: true, category: updated };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_categories')
      .update(data)
      .eq('id', categoryId)
      .select();

    if (error) {
      console.warn('Supabase update category error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase update category: 0 rows affected');
      return { success: false, error: 'Catégorie introuvable ou mise à jour échouée.' };
    }

    const updatedCat = updatedRows[0] as Category;
    store.updateCategoryLocally(categoryId, updatedCat);
    return { success: true, category: updatedCat };
  } catch (err: any) {
    console.warn('Supabase update category exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * Delete a category from platform_categories in Supabase.
 */
export async function deleteCategory(
  categoryId: string
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.deleteCategoryLocally(categoryId);
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: deletedRows, error } = await (client as any)
      .from('platform_categories')
      .delete()
      .eq('id', categoryId)
      .select();

    if (error) {
      console.warn('Supabase delete category error:', error.message);
      return { success: false, error: error.message };
    }

    if (!deletedRows || deletedRows.length === 0) {
      console.warn('Supabase delete category: 0 rows affected');
      return { success: false, error: 'Catégorie introuvable ou déjà supprimée.' };
    }

    store.deleteCategoryLocally(categoryId);
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase delete category exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * ============================================================================
 * PRODUCTS CRUD (platform_products)
 * ============================================================================
 */

/**
 * Fetch products for a business from platform_products in Supabase.
 * Returns empty array if error or no credentials (no invented data).
 */
export async function fetchProductsForBusiness(businessId: string): Promise<Product[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return [];
  }

  try {
    const client = getSupabase();
    const { data, error } = await (client as any)
      .from('platform_products')
      .select('*')
      .eq('business_id', businessId);

    if (error) {
      console.warn('Supabase fetch products error:', error.message);
      return [];
    }

    return (data as Product[]) || [];
  } catch (err: any) {
    console.warn('Supabase fetch products exception:', err?.message || err);
    return [];
  }
}

/**
 * Insert a product into platform_products in Supabase.
 */
export async function insertProduct(data: {
  business_id: string;
  category_id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  available?: boolean;
  stock_qty?: number | null;
}): Promise<{ success: boolean; product?: Product; error?: string }> {
  const store = getStore();
  const newId = `prod_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;

  const recordToInsert: Product = {
    id: newId,
    business_id: data.business_id,
    category_id: data.category_id,
    name: data.name.trim(),
    price: Number(data.price),
    description: data.description?.trim() || '',
    image_url:
      data.image_url?.trim() ||
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    available: data.available !== undefined ? data.available : true,
    stock_qty: data.stock_qty !== undefined ? data.stock_qty : null,
  };

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.addProductLocally(recordToInsert);
    return { success: true, product: recordToInsert };
  }

  try {
    const client = getSupabase();
    const { data: insertedRows, error } = await (client as any)
      .from('platform_products')
      .insert(recordToInsert)
      .select();

    if (error) {
      console.warn('Supabase insert product error:', error.message);
      return { success: false, error: error.message };
    }

    if (!insertedRows || insertedRows.length === 0) {
      console.warn('Supabase insert product: 0 rows returned');
      return { success: false, error: "L'insertion du produit n'a retourné aucun enregistrement." };
    }

    const insertedProd = insertedRows[0] as Product;
    store.addProductLocally(insertedProd);
    return { success: true, product: insertedProd };
  } catch (err: any) {
    console.warn('Supabase insert product exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * Update a product in platform_products in Supabase.
 */
export async function updateProduct(
  productId: string,
  data: Partial<Omit<Product, 'id' | 'business_id'>>
): Promise<{ success: boolean; product?: Product; error?: string }> {
  const store = getStore();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.updateProductLocally(productId, data);
    const updated = store.products.find((p) => p.id === productId);
    return { success: true, product: updated };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_products')
      .update(data)
      .eq('id', productId)
      .select();

    if (error) {
      console.warn('Supabase update product error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase update product: 0 rows affected');
      return { success: false, error: 'Produit introuvable ou mise à jour échouée.' };
    }

    const updatedProd = updatedRows[0] as Product;
    store.updateProductLocally(productId, updatedProd);
    return { success: true, product: updatedProd };
  } catch (err: any) {
    console.warn('Supabase update product exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * Delete a product from platform_products in Supabase.
 */
export async function deleteProduct(
  productId: string
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.deleteProductLocally(productId);
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: deletedRows, error } = await (client as any)
      .from('platform_products')
      .delete()
      .eq('id', productId)
      .select();

    if (error) {
      console.warn('Supabase delete product error:', error.message);
      return { success: false, error: error.message };
    }

    if (!deletedRows || deletedRows.length === 0) {
      console.warn('Supabase delete product: 0 rows affected');
      return { success: false, error: 'Produit introuvable ou déjà supprimé.' };
    }

    store.deleteProductLocally(productId);
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase delete product exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * ============================================================================
 * CUSTOMERS & MESSAGING (platform_customers, platform_customer_messages)
 * ============================================================================
 */

/**
 * Fetch customers for a business from platform_customers in Supabase.
 * Returns empty array if error or no credentials (no invented data).
 */
export async function fetchCustomersForBusiness(businessId: string): Promise<Customer[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return [];
  }

  try {
    const client = getSupabase();
    console.log('[DEBUG_FETCH] fetchCustomersForBusiness START', { businessId, timestamp: Date.now() });
    const { data, error } = await (client as any)
      .from('platform_customers')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DEBUG_FETCH] Supabase returned ERROR', { businessId, errorMessage: error.message, errorCode: error.code, errorDetails: error.details, fullError: error });
      console.warn('Supabase fetch customers error:', error.message);
      return [];
    }

    console.log('[DEBUG_FETCH] SUCCESS', { businessId, count: data?.length, timestamp: Date.now() });
    return (data as Customer[]) || [];
  } catch (err: any) {
    console.error('[DEBUG_FETCH] EXCEPTION caught', { businessId, errMessage: err?.message, errName: err?.name, errStack: err?.stack, fullErr: err });
    console.warn('Supabase fetch customers exception:', err?.message || err);
    return [];
  }
}

/**
 * Fetch messages for a customer from platform_customer_messages in Supabase.
 * Ordered chronologically by created_at.
 */
export async function fetchMessagesForCustomer(customerId: string): Promise<CustomerMessage[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const store = getStore();
    return store.getCustomerMessages(customerId);
  }

  try {
    const client = getSupabase();
    const { data, error } = await (client as any)
      .from('platform_customer_messages')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetch customer messages error:', error.message);
      return [];
    }

    const messages = (data as CustomerMessage[]) || [];
    const store = getStore();
    store.setCustomerMessages(customerId, messages);
    return messages;
  } catch (err: any) {
    console.warn('Supabase fetch customer messages exception:', err?.message || err);
    return [];
  }
}

/**
 * Send a message (merchant or customer) and insert into platform_customer_messages.
 * Strict anti-false-success check on inserted rows.
 */
export async function sendMessage(data: {
  business_id: string;
  customer_id: string;
  sender: 'merchant' | 'customer';
  content?: string;
  media_url?: string;
  media_type?: string;
  media_name?: string;
  media_size?: number;
}): Promise<{ success: boolean; message?: CustomerMessage; error?: string }> {
  const store = getStore();
  const newId = `cmsg_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
  const now = new Date().toISOString();

  const recordToInsert: CustomerMessage = {
    id: newId,
    business_id: data.business_id,
    customer_id: data.customer_id,
    sender: data.sender || 'merchant',
    content: data.content?.trim() || null,
    media_url: data.media_url?.trim() || null,
    media_type: data.media_type || null,
    media_name: data.media_name || null,
    media_size: data.media_size || null,
    is_read: data.sender === 'merchant' ? true : false,
    created_at: now,
  };

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.addCustomerMessage(recordToInsert);
    return { success: true, message: recordToInsert };
  }

  try {
    const client = getSupabase();
    const { data: insertedRows, error } = await (client as any)
      .from('platform_customer_messages')
      .insert(recordToInsert)
      .select();

    if (error) {
      console.warn('Supabase send customer message error:', error.message);
      return { success: false, error: error.message };
    }

    if (!insertedRows || insertedRows.length === 0) {
      console.warn('Supabase send customer message: 0 rows returned');
      return { success: false, error: "L'envoi du message a échoué (aucun enregistrement retourné)." };
    }

    const insertedMsg = insertedRows[0] as CustomerMessage;
    store.addCustomerMessage(insertedMsg);

    // Update customer last_active_at if possible
    try {
      await (client as any)
        .from('platform_customers')
        .update({ last_active_at: now })
        .eq('id', data.customer_id);
    } catch {
      // Non-blocking
    }

    return { success: true, message: insertedMsg };
  } catch (err: any) {
    console.warn('Supabase send customer message exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * Upload a customer media file (image, PDF, doc, audio, video) to bucket platform-customer-media.
 * - Enforces max 10MB limit with explicit error message.
 * - Generates sanitized server-side filename.
 * - Detects accurate MIME content-type.
 * - Returns public URL.
 */
export async function uploadCustomerMedia(
  input: File | Blob | string,
  businessId: string,
  customName?: string
): Promise<{
  success: boolean;
  url?: string;
  media_type?: 'image' | 'video' | 'audio' | 'document' | 'other';
  media_name?: string;
  media_size?: number;
  error?: string;
}> {
  if (!input) {
    return { success: false, error: 'Fichier manquant' };
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
  let fileBlob: Blob;
  let contentType = 'application/octet-stream';
  let fileExt = 'bin';
  let originalName = customName || 'media';
  let fileSize = 0;

  if (typeof input === 'string' && input.startsWith('data:')) {
    const parsed = dataUrlToBlob(input);
    fileBlob = parsed.blob;
    contentType = parsed.contentType;
    fileSize = fileBlob.size;
    const parts = contentType.split('/');
    fileExt = parts[1] || 'bin';
    if (fileExt.includes(';')) fileExt = fileExt.split(';')[0];
  } else if (input instanceof File) {
    fileBlob = input;
    contentType = input.type || 'application/octet-stream';
    originalName = customName || input.name;
    fileSize = input.size;
    const extMatch = input.name.split('.').pop();
    if (extMatch) fileExt = extMatch.toLowerCase();
  } else if (input instanceof Blob) {
    fileBlob = input;
    contentType = input.type || 'application/octet-stream';
    fileSize = input.size;
    const parts = contentType.split('/');
    fileExt = parts[1] || 'bin';
    if (fileExt.includes(';')) fileExt = fileExt.split(';')[0];
  } else {
    return { success: false, error: 'Format de fichier non valide' };
  }

  // File size validation: 10MB limit
  if (fileSize > MAX_FILE_SIZE) {
    const sizeMo = (fileSize / (1024 * 1024)).toFixed(1);
    return {
      success: false,
      error: `Le fichier dépasse la taille maximale autorisée de 10 Mo (taille actuelle : ${sizeMo} Mo).`,
    };
  }

  // Detect media category (image, document, audio, video, other)
  let mediaCategory: 'image' | 'video' | 'audio' | 'document' | 'other' = 'other';
  if (contentType.startsWith('image/')) {
    mediaCategory = 'image';
  } else if (contentType.startsWith('video/')) {
    mediaCategory = 'video';
  } else if (contentType.startsWith('audio/')) {
    mediaCategory = 'audio';
  } else if (
    contentType.includes('pdf') ||
    contentType.includes('document') ||
    contentType.includes('msword') ||
    contentType.includes('sheet') ||
    contentType.includes('presentation') ||
    contentType.includes('text/') ||
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'ppt', 'pptx'].includes(fileExt)
  ) {
    mediaCategory = 'document';
  }

  // Sanitized unique filename on server side
  const sanitizedExt = fileExt.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${sanitizedExt}`;
  const filePath = `${businessId}/${fileName}`;

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (hasCredentials) {
    try {
      const client = getSupabase();
      const BUCKET_NAME = 'platform-customer-media';

      const uploadRes = await client.storage
        .from(BUCKET_NAME)
        .upload(filePath, fileBlob, { upsert: true, contentType });

      if (uploadRes.error) {
        console.error(`Upload to ${BUCKET_NAME} failed:`, uploadRes.error.message);
        return {
          success: false,
          error: `Échec de l'upload sur Supabase Storage : ${uploadRes.error.message}`,
        };
      }

      if (uploadRes.data) {
        const { data: publicUrlData } = client.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          return {
            success: true,
            url: publicUrlData.publicUrl,
            media_type: mediaCategory,
            media_name: originalName,
            media_size: fileSize,
          };
        }
      }
    } catch (err: any) {
      console.error('Supabase storage customer media upload exception:', err);
      return { success: false, error: err?.message || "Erreur lors de l'upload du fichier" };
    }
  }

  // Fallback to data URL only if Supabase keys are absent
  if (typeof input === 'string') {
    return {
      success: true,
      url: input,
      media_type: mediaCategory,
      media_name: originalName,
      media_size: fileSize,
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve({
          success: true,
          url: reader.result,
          media_type: mediaCategory,
          media_name: originalName,
          media_size: fileSize,
        });
      } else {
        resolve({ success: false, error: 'Conversion du fichier en base64 échouée' });
      }
    };
    reader.onerror = () =>
      resolve({ success: false, error: 'Erreur lors de la lecture du fichier' });
    reader.readAsDataURL(fileBlob);
  });
}

/**
 * Construit une URL de téléchargement forcé pour Supabase Storage
 * en ajoutant le paramètre ?download=nom_du_fichier
 */
export function getDownloadUrl(url: string, filename: string): string {
  if (!url) return '';
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}download=${encodeURIComponent(filename)}`;
}

/**
 * Mark a message as read in platform_customer_messages in Supabase.
 */
export async function markMessageAsRead(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.markMessageAsReadLocally(messageId);
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_customer_messages')
      .update({ is_read: true })
      .eq('id', messageId)
      .select();

    if (error) {
      console.warn('Supabase mark message as read error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase mark message as read: 0 rows affected');
      return { success: false, error: 'Message introuvable ou mise à jour échouée.' };
    }

    store.markMessageAsReadLocally(messageId);
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase mark message as read exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * Delete a message from platform_customer_messages in Supabase.
 * Enforces strict verification that the row was actually deleted (deletedRows.length > 0).
 */
export async function deleteMessage(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.deleteCustomerMessageLocally(messageId);
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: deletedRows, error } = await (client as any)
      .from('platform_customer_messages')
      .delete()
      .eq('id', messageId)
      .select();

    if (error) {
      console.warn('Supabase delete message error:', error.message);
      return { success: false, error: error.message };
    }

    if (!deletedRows || deletedRows.length === 0) {
      console.warn('Supabase delete message: 0 rows affected');
      return { success: false, error: 'Message introuvable ou déjà supprimé.' };
    }

    store.deleteCustomerMessageLocally(messageId);
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase delete message exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion lors de la suppression' };
  }
}

/**
 * Mark a customer as favorite (or toggle favorite) in platform_customers in Supabase.
 */
export async function markCustomerAsFavorite(
  customerId: string,
  isFavorite: boolean
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.updateCustomerLocally(customerId, { is_favorite: isFavorite });
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_customers')
      .update({ is_favorite: isFavorite })
      .eq('id', customerId)
      .select();

    if (error) {
      console.warn('Supabase mark customer as favorite error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase mark customer as favorite: 0 rows affected');
      return { success: false, error: 'Client introuvable ou mise à jour échouée.' };
    }

    store.updateCustomerLocally(customerId, { is_favorite: isFavorite });
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase mark customer as favorite exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * Update an existing customer profile in platform_customers.
 * Modifiable fields: name, phone, channel_preference, notes, avatar_url.
 */
export async function updateCustomer(
  customerId: string,
  updates: {
    name?: string;
    phone?: string;
    channel_preference?: 'whatsapp' | 'app';
    notes?: string;
    avatar_url?: string;
  }
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  const store = getStore();
  const updatePayload: Record<string, any> = {};

  if (updates.name !== undefined) {
    updatePayload.name = updates.name.trim();
  }
  if (updates.phone !== undefined) {
    updatePayload.phone = updates.phone.trim();
    updatePayload.whatsapp_id = updates.phone.trim();
  }
  if (updates.channel_preference !== undefined) {
    updatePayload.channel_preference = updates.channel_preference;
  }
  if (updates.notes !== undefined) {
    updatePayload.notes = updates.notes ? updates.notes.trim() : null;
  }
  if (updates.avatar_url !== undefined) {
    updatePayload.avatar_url = updates.avatar_url || null;
  }

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.updateCustomerLocally(customerId, updatePayload);
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_customers')
      .update(updatePayload)
      .eq('id', customerId)
      .select();

    if (error) {
      console.warn('Supabase update customer error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase update customer: 0 rows affected');
      return { success: false, error: 'Client introuvable ou mise à jour échouée.' };
    }

    const updatedCustomer = updatedRows[0] as Customer;
    store.updateCustomerLocally(customerId, updatedCustomer);
    return { success: true, customer: updatedCustomer };
  } catch (err: any) {
    console.warn('Supabase update customer exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * Upload customer avatar image to Supabase Storage ('platform-customer-avatars' or fallback bucket).
 * Handles File, Blob, and base64 Data URLs.
 * Returns public HTTPS URL.
 */
export async function uploadCustomerAvatar(
  input: File | Blob | string,
  businessId: string
): Promise<string> {
  // If input is already an HTTP(S) URL, return it directly
  if (typeof input === 'string' && (input.startsWith('http://') || input.startsWith('https://'))) {
    return input;
  }

  let fileBlob: Blob;
  let contentType = 'image/jpeg';
  let fileExt = 'jpg';

  if (typeof input === 'string' && input.startsWith('data:')) {
    const parsed = dataUrlToBlob(input);
    fileBlob = parsed.blob;
    contentType = parsed.contentType;
    fileExt = contentType.split('/')[1] || 'jpg';
  } else if (input instanceof File) {
    fileBlob = input;
    contentType = input.type || 'image/jpeg';
    fileExt = input.name.split('.').pop() || 'jpg';
  } else if (input instanceof Blob) {
    fileBlob = input;
    contentType = input.type || 'image/jpeg';
    fileExt = contentType.split('/')[1] || 'jpg';
  } else {
    return '';
  }

  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
  const filePath = `${businessId}/${fileName}`;

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (hasCredentials) {
    try {
      const client = getSupabase();
      const BUCKET_NAME = 'platform-customer-avatars';

      let uploadRes = await client.storage
        .from(BUCKET_NAME)
        .upload(filePath, fileBlob, { upsert: true, contentType });

      let targetBucket = BUCKET_NAME;

      if (uploadRes.error) {
        console.warn(`Upload to ${BUCKET_NAME} failed, trying fallback to platform-staff-avatars:`, uploadRes.error.message);
        targetBucket = 'platform-staff-avatars';
        uploadRes = await client.storage
          .from(targetBucket)
          .upload(filePath, fileBlob, { upsert: true, contentType });
      }

      if (uploadRes.error) {
        console.error(`Upload customer avatar failed:`, uploadRes.error.message);
        throw new Error(`Échec de l'upload de la photo: ${uploadRes.error.message}`);
      }

      if (uploadRes.data) {
        const { data: publicUrlData } = client.storage
          .from(targetBucket)
          .getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
    } catch (err: any) {
      console.error('Supabase customer avatar upload exception:', err);
      throw err;
    }
  }

  // Fallback to reading file as Data URL only if Supabase keys are absent
  if (typeof input === 'string') return input;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to Data URL'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading image file'));
    reader.readAsDataURL(fileBlob);
  });
}

/**
 * Insert a customer into platform_customers in Supabase.
 * Uses strict anti-false-success checks and updates local store.
 */
export async function insertCustomer(data: {
  business_id: string;
  name: string;
  phone: string;
  whatsapp_id?: string;
  channel_preference?: 'whatsapp' | 'app';
  avatar_url?: string;
  notes?: string;
}): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  const store = getStore();
  const newId = `cust_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
  const now = new Date().toISOString();

  let resolvedAvatarUrl: string | undefined = data.avatar_url;
  if (resolvedAvatarUrl && resolvedAvatarUrl.startsWith('data:')) {
    try {
      resolvedAvatarUrl = await uploadCustomerAvatar(resolvedAvatarUrl, data.business_id);
    } catch (uploadErr) {
      console.warn('Error uploading customer avatar before insert:', uploadErr);
    }
  }

  const recordToInsert: Customer = {
    id: newId,
    business_id: data.business_id,
    name: data.name.trim(),
    phone: data.phone.trim(),
    whatsapp_id: data.whatsapp_id?.trim() || data.phone.trim(),
    channel_preference: data.channel_preference || 'whatsapp',
    avatar_url: resolvedAvatarUrl || undefined,
    notes: data.notes?.trim() || undefined,
    is_favorite: false,
    created_at: now,
    last_active_at: now,
  };

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.addCustomerLocally(recordToInsert);
    return { success: true, customer: recordToInsert };
  }

  try {
    const client = getSupabase();
    const { data: insertedRows, error } = await (client as any)
      .from('platform_customers')
      .insert(recordToInsert)
      .select();

    if (error) {
      console.warn('Supabase insert customer error:', error.message);
      return { success: false, error: error.message };
    }

    if (!insertedRows || insertedRows.length === 0) {
      console.warn('Supabase insert customer: 0 rows returned');
      return { success: false, error: "L'insertion du client n'a retourné aucun enregistrement." };
    }

    const insertedCustomer = insertedRows[0] as Customer;
    store.addCustomerLocally(insertedCustomer);
    return { success: true, customer: insertedCustomer };
  } catch (err: any) {
    console.warn('Supabase insert customer exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * ============================================================================
 * ORDERS & ORDER ITEMS CRUD (platform_orders, platform_order_items)
 * ============================================================================
 */

/**
 * 1. Fetch all orders for a business from platform_orders in Supabase,
 * ordered by created_at descending.
 * Returns empty array if error or no credentials (never invented mock data).
 */
export async function fetchOrdersForBusiness(businessId: string): Promise<Order[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const store = getStore();
    return store.orders.filter((o) => o.business_id === businessId);
  }

  try {
    const client = getSupabase();
    const { data: rawOrders, error } = await (client as any)
      .from('platform_orders')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch orders error:', error.message);
      return [];
    }

    const orders = (rawOrders as Order[]) || [];
    if (orders.length === 0) {
      return [];
    }

    const customerIds = Array.from(new Set(orders.map((o) => o.customer_id).filter(Boolean)));
    if (customerIds.length === 0) {
      return orders;
    }

    const { data: customersData, error: customersError } = await (client as any)
      .from('platform_customers')
      .select('id, name, phone, avatar_url')
      .in('id', customerIds);

    if (customersError) {
      console.warn('Supabase fetch order customers error:', customersError.message);
      return orders;
    }

    const customerMap = new Map<string, { name: string; phone: string; avatar_url?: string }>();
    for (const c of (customersData || [])) {
      customerMap.set(c.id, c);
    }

    return orders.map((order) => {
      const cust = customerMap.get(order.customer_id);
      return {
        ...order,
        customer_name: cust?.name,
        customer_phone: cust?.phone,
        customer_avatar: cust?.avatar_url,
      };
    });
  } catch (err: any) {
    console.warn('Supabase fetch orders exception:', err?.message || err);
    return [];
  }
}

/**
 * 2. Fetch order items for a specific order from platform_order_items in Supabase.
 * Returns empty array if error or no credentials.
 */
export async function fetchOrderItemsForOrder(orderId: string): Promise<OrderItem[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const store = getStore();
    const order = store.orders.find((o) => o.id === orderId);
    return order?.items || [];
  }

  try {
    const client = getSupabase();
    const { data, error } = await (client as any)
      .from('platform_order_items')
      .select('*')
      .eq('order_id', orderId);

    if (error) {
      console.warn('Supabase fetch order items error:', error.message);
      return [];
    }

    return (data as OrderItem[]) || [];
  } catch (err: any) {
    console.warn('Supabase fetch order items exception:', err?.message || err);
    return [];
  }
}

/**
 * 3. Insert an order AND its items into platform_orders and platform_order_items.
 * - Generates order ID: `order_${crypto.randomUUID() || Date.now()}`
 * - Inserts row in platform_orders with strict anti-false-success check
 * - Inserts items in platform_order_items with strict check
 * - Returns honest error message if items fail after order creation
 */
export async function insertOrder(data: {
  business_id: string;
  customer_id: string;
  total_amount: number;
  status?: OrderStatus | string;
  payment_status?: PaymentStatus | string;
  payment_method?: string;
  payment_reference?: string | null;
  order_type?: 'delivery' | 'pickup' | string;
  delivery_address?: string | null;
  delivery_zone_id?: string | null;
  delivery_zone_name?: string | null;
  delivery_fee?: number;
  customer_lat?: number | null;
  customer_lng?: number | null;
  assigned_to?: string | null;
  cancellation_reason?: string | null;
  internal_note?: string | null;
  rating?: number | null;
  rating_comment?: string | null;
  priority_level?: string | null;
  urgent_surcharge_applied?: number | null;
  items?: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    product_name?: string;
  }>;
}): Promise<{ success: boolean; order?: Order; error?: string }> {
  const store = getStore();
  const orderId = `order_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
  const now = new Date().toISOString();

  const orderRecord: any = {
    id: orderId,
    business_id: data.business_id,
    customer_id: data.customer_id,
    status: data.status || 'pending',
    total_amount: Number(data.total_amount),
    payment_status: data.payment_status || 'unpaid',
    payment_method: data.payment_method || null,
    payment_reference: data.payment_reference || null,
    order_type: data.order_type || 'delivery',
    delivery_address: data.delivery_address || null,
    delivery_zone_id: data.delivery_zone_id || null,
    delivery_zone_name: data.delivery_zone_name || null,
    delivery_fee: data.delivery_fee !== undefined ? Number(data.delivery_fee) : 0,
    customer_lat: data.customer_lat !== undefined ? data.customer_lat : null,
    customer_lng: data.customer_lng !== undefined ? data.customer_lng : null,
    assigned_to: data.assigned_to || null,
    cancellation_reason: data.cancellation_reason || null,
    internal_note: data.internal_note || null,
    rating: data.rating !== undefined ? data.rating : null,
    rating_comment: data.rating_comment || null,
    priority_level: data.priority_level || null,
    urgent_surcharge_applied: data.urgent_surcharge_applied !== undefined ? data.urgent_surcharge_applied : null,
    created_at: now,
    updated_at: now,
  };

  const orderItemsRecords: OrderItem[] = (data.items || []).map((item, idx) => ({
    id: `item_${orderId}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
    order_id: orderId,
    product_id: item.product_id,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    product_name: item.product_name || undefined,
  }));

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const fullOrder: Order = {
      ...orderRecord,
      items: orderItemsRecords,
    };
    store.orders.unshift(fullOrder);
    store.notify();
    return { success: true, order: fullOrder };
  }

  try {
    const client = getSupabase();

    // 1. Insert order into platform_orders
    const { data: insertedOrders, error: orderError } = await (client as any)
      .from('platform_orders')
      .insert(orderRecord)
      .select();

    if (orderError) {
      console.warn('Supabase insert order error:', orderError.message);
      return { success: false, error: orderError.message };
    }

    if (!insertedOrders || insertedOrders.length === 0) {
      console.warn('Supabase insert order: 0 rows returned');
      return { success: false, error: "L'insertion de la commande n'a retourné aucun enregistrement." };
    }

    const insertedOrder = insertedOrders[0] as Order;

    // 2. Insert items into platform_order_items if any
    if (orderItemsRecords.length > 0) {
      const itemsToInsert = orderItemsRecords.map((item) => ({
        id: item.id,
        order_id: orderId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        product_name: item.product_name || null,
      }));

      const { data: insertedItems, error: itemsError } = await (client as any)
        .from('platform_order_items')
        .insert(itemsToInsert)
        .select();

      if (itemsError) {
        console.warn('Supabase insert order items error:', itemsError.message);
        return {
          success: false,
          error: `La commande #${orderId} a été créée mais l'insertion de ses articles a échoué : ${itemsError.message}`,
        };
      }

      if (!insertedItems || insertedItems.length === 0) {
        console.warn('Supabase insert order items: 0 rows returned');
        return {
          success: false,
          error: `La commande #${orderId} a été créée mais aucun article n'a pu être enregistré en base de données.`,
        };
      }

      insertedOrder.items = insertedItems as OrderItem[];
    } else {
      insertedOrder.items = [];
    }

    // Update local store cache
    const existingIdx = store.orders.findIndex((o) => o.id === orderId);
    if (existingIdx > -1) {
      store.orders[existingIdx] = insertedOrder;
    } else {
      store.orders.unshift(insertedOrder);
    }
    store.notify();

    return { success: true, order: insertedOrder };
  } catch (err: any) {
    console.warn('Supabase insert order exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 4. Update order status in platform_orders.
 * Updates status and updated_at, with strict anti-false-success check.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus | string
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();
  const now = new Date().toISOString();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const order = store.orders.find((o) => o.id === orderId);
    if (order) {
      order.status = newStatus as OrderStatus;
      order.updated_at = now;
      store.notify();
    }
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_orders')
      .update({
        status: newStatus,
        updated_at: now,
      })
      .eq('id', orderId)
      .select();

    if (error) {
      console.warn('Supabase update order status error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase update order status: 0 rows affected');
      return { success: false, error: 'Commande introuvable ou statut non modifié.' };
    }

    const order = store.orders.find((o) => o.id === orderId);
    if (order) {
      order.status = newStatus as OrderStatus;
      order.updated_at = now;
      store.notify();
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Supabase update order status exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 5. Update order payment status in platform_orders.
 * Updates payment_status and updated_at, with strict anti-false-success check.
 */
export async function updateOrderPaymentStatus(
  orderId: string,
  newPaymentStatus: PaymentStatus | string
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();
  const now = new Date().toISOString();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const order = store.orders.find((o) => o.id === orderId);
    if (order) {
      order.payment_status = newPaymentStatus as PaymentStatus;
      order.updated_at = now;
      store.notify();
    }
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_orders')
      .update({
        payment_status: newPaymentStatus,
        updated_at: now,
      })
      .eq('id', orderId)
      .select();

    if (error) {
      console.warn('Supabase update order payment status error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase update order payment status: 0 rows affected');
      return { success: false, error: 'Commande introuvable ou statut de paiement non modifié.' };
    }

    const order = store.orders.find((o) => o.id === orderId);
    if (order) {
      order.payment_status = newPaymentStatus as PaymentStatus;
      order.updated_at = now;
      store.notify();
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Supabase update order payment status exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 5b. Update order payment and confirmation status in platform_orders.
 * Sets payment_status = 'paid', payment_reference, and status = 'confirmed' (if was pending).
 */
export async function updateOrderPaymentInSupabase(
  orderId: string,
  paymentReference: string,
  shouldConfirm: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return { success: true };
  }

  try {
    const client = getSupabase();
    const updatePayload: Record<string, any> = {
      payment_status: 'paid',
      payment_reference: paymentReference,
      updated_at: now,
    };
    if (shouldConfirm) {
      updatePayload.status = 'confirmed';
    }

    const { data: updatedRows, error } = await (client as any)
      .from('platform_orders')
      .update(updatePayload)
      .eq('id', orderId)
      .select();

    if (error) {
      console.warn('Supabase update order payment error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase update order payment: 0 rows affected');
      return { success: false, error: 'Commande introuvable ou paiement non modifié.' };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Supabase update order payment exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 6. Cancel an order in platform_orders with a reason.
 * Sets status = 'cancelled', cancellation_reason = reason, and updated_at = now().
 * Strict anti-false-success check on updatedRows.
 */
export async function cancelOrder(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();
  const now = new Date().toISOString();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const order = store.orders.find((o) => o.id === orderId);
    if (order) {
      order.status = 'cancelled';
      order.cancellation_reason = reason.trim();
      order.updated_at = now;
      store.notify();
    }
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_orders')
      .update({
        status: 'cancelled',
        cancellation_reason: reason.trim(),
        updated_at: now,
      })
      .eq('id', orderId)
      .select();

    if (error) {
      console.warn('Supabase cancel order error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase cancel order: 0 rows affected');
      return { success: false, error: 'Commande introuvable ou annulation échouée.' };
    }

    const order = store.orders.find((o) => o.id === orderId);
    if (order) {
      order.status = 'cancelled';
      order.cancellation_reason = reason.trim();
      order.updated_at = now;
      store.notify();
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Supabase cancel order exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * ============================================================================
 * EXPENSES CRUD (platform_expenses)
 * ============================================================================
 */

/**
 * 1. Fetch all expenses for a business from platform_expenses in Supabase,
 * ordered by date descending.
 * Optional startDate and endDate filters using .gte('date', startDate) and .lte('date', endDate).
 * Returns empty array if error or no credentials (never invented mock data).
 */
export async function fetchExpensesForBusiness(
  businessId: string,
  startDate?: string,
  endDate?: string
): Promise<Expense[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return [];
  }

  try {
    const client = getSupabase();
    let query = (client as any)
      .from('platform_expenses')
      .select('*')
      .eq('business_id', businessId)
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Supabase fetch expenses error:', error.message);
      return [];
    }

    return (data as Expense[]) || [];
  } catch (err: any) {
    console.warn('Supabase fetch expenses exception:', err?.message || err);
    return [];
  }
}

/**
 * 2. Insert a new expense into platform_expenses in Supabase.
 * Generates an id with 'exp_' prefix.
 * Enforces strict verification that insertedRows.length > 0.
 */
export async function insertExpense(data: {
  business_id: string;
  category: ExpenseCategory;
  label: string;
  amount: number;
  date: string;
  is_recurring?: boolean;
  created_by: string;
}): Promise<{ success: boolean; expense?: Expense; error?: string }> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return { success: false, error: 'Configuration Supabase manquante' };
  }

  const newId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const recordToInsert: Expense = {
    id: newId,
    business_id: data.business_id,
    category: data.category,
    label: data.label.trim(),
    amount: Number(data.amount),
    date: data.date,
    is_recurring: Boolean(data.is_recurring),
    created_by: data.created_by,
    created_at: now,
  };

  try {
    const client = getSupabase();
    const { data: insertedRows, error } = await (client as any)
      .from('platform_expenses')
      .insert(recordToInsert)
      .select();

    if (error) {
      console.warn('Supabase insert expense error:', error.message);
      return { success: false, error: error.message };
    }

    if (!insertedRows || insertedRows.length === 0) {
      console.warn('Supabase insert expense: 0 rows returned');
      return { success: false, error: "L'insertion de la dépense n'a retourné aucun enregistrement." };
    }

    const insertedExpense = insertedRows[0] as Expense;
    return { success: true, expense: insertedExpense };
  } catch (err: any) {
    console.warn('Supabase insert expense exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 3. Update an existing expense in platform_expenses in Supabase.
 * Enforces strict verification that updatedRows.length > 0.
 */
export async function updateExpense(
  expenseId: string,
  data: Partial<Omit<Expense, 'id' | 'business_id'>>
): Promise<{ success: boolean; expense?: Expense; error?: string }> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return { success: false, error: 'Configuration Supabase manquante' };
  }

  try {
    const client = getSupabase();
    const updatePayload: Record<string, any> = {};

    if (data.category !== undefined) updatePayload.category = data.category;
    if (data.label !== undefined) updatePayload.label = data.label.trim();
    if (data.amount !== undefined) updatePayload.amount = Number(data.amount);
    if (data.date !== undefined) updatePayload.date = data.date;
    if (data.is_recurring !== undefined) updatePayload.is_recurring = Boolean(data.is_recurring);
    if (data.created_by !== undefined) updatePayload.created_by = data.created_by;

    const { data: updatedRows, error } = await (client as any)
      .from('platform_expenses')
      .update(updatePayload)
      .eq('id', expenseId)
      .select();

    if (error) {
      console.warn('Supabase update expense error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase update expense: 0 rows affected');
      return { success: false, error: 'Dépense introuvable ou mise à jour échouée.' };
    }

    const updatedExpense = updatedRows[0] as Expense;
    return { success: true, expense: updatedExpense };
  } catch (err: any) {
    console.warn('Supabase update expense exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 4. Delete an expense from platform_expenses in Supabase.
 * Enforces strict verification that deletedRows.length > 0.
 */
export async function deleteExpense(
  expenseId: string
): Promise<{ success: boolean; error?: string }> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return { success: false, error: 'Configuration Supabase manquante' };
  }

  try {
    const client = getSupabase();
    const { data: deletedRows, error } = await (client as any)
      .from('platform_expenses')
      .delete()
      .eq('id', expenseId)
      .select();

    if (error) {
      console.warn('Supabase delete expense error:', error.message);
      return { success: false, error: error.message };
    }

    if (!deletedRows || deletedRows.length === 0) {
      console.warn('Supabase delete expense: 0 rows affected');
      return { success: false, error: 'Dépense introuvable ou déjà supprimée.' };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Supabase delete expense exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion lors de la suppression' };
  }
}

/**
 * ============================================================================
 * EXPENSE CATEGORIES CRUD (platform_expense_categories)
 * ============================================================================
 */

/**
 * 1. Fetch all active expense categories for a business from platform_expense_categories in Supabase,
 * ordered by name ascending.
 * Returns empty array if error or no credentials.
 */
export async function fetchExpenseCategoriesForBusiness(
  businessId: string
): Promise<ExpenseCategoryItem[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return [];
  }

  try {
    const client = getSupabase();
    const { data, error } = await (client as any)
      .from('platform_expense_categories')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.warn('Supabase fetch expense categories error:', error.message);
      return [];
    }

    return (data as ExpenseCategoryItem[]) || [];
  } catch (err: any) {
    console.warn('Supabase fetch expense categories exception:', err?.message || err);
    return [];
  }
}

/**
 * 1b. Fetch all trashed (is_active = false) expense categories for a business.
 */
export async function fetchTrashedCategoriesForBusiness(
  businessId: string
): Promise<ExpenseCategoryItem[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return [];
  }

  try {
    const client = getSupabase();
    const { data, error } = await (client as any)
      .from('platform_expense_categories')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', false)
      .order('name', { ascending: true });

    if (error) {
      console.warn('Supabase fetch trashed expense categories error:', error.message);
      return [];
    }

    return (data as ExpenseCategoryItem[]) || [];
  } catch (err: any) {
    console.warn('Supabase fetch trashed expense categories exception:', err?.message || err);
    return [];
  }
}

/**
 * 1c. Update active status (soft delete / restore) for an expense category in Supabase.
 */
export async function updateExpenseCategoryActiveStatus(
  categoryId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return { success: false, error: 'Configuration Supabase manquante' };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_expense_categories')
      .update({ is_active: isActive })
      .eq('id', categoryId)
      .select();

    if (error) {
      console.warn('Supabase update expense category active status error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase update expense category active status: 0 rows affected');
      return { success: false, error: 'Catégorie de dépense introuvable.' };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Supabase update expense category active status exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion' };
  }
}

export async function softDeleteExpenseCategory(
  categoryId: string
): Promise<{ success: boolean; error?: string }> {
  return updateExpenseCategoryActiveStatus(categoryId, false);
}

export async function restoreExpenseCategory(
  categoryId: string
): Promise<{ success: boolean; error?: string }> {
  return updateExpenseCategoryActiveStatus(categoryId, true);
}

/**
 * 2. Insert a new expense category into platform_expense_categories in Supabase.
 * - Generates an id TEXT: `expcat_${crypto.randomUUID() ou Date.now()}`
 * - Checks if a category with the same trimmed case-insensitive name already exists for this business_id
 * - Inserts with strict verification insertedRows.length > 0
 */
export async function insertExpenseCategory(data: {
  business_id: string;
  name: string;
}): Promise<{ success: boolean; category?: ExpenseCategoryItem; error?: string }> {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    return { success: false, error: 'Le nom de la catégorie est requis.' };
  }

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return { success: false, error: 'Configuration Supabase manquante' };
  }

  try {
    const client = getSupabase();

    // Check for duplicate name (case-insensitive) for this business
    const { data: existingRows, error: fetchError } = await (client as any)
      .from('platform_expense_categories')
      .select('id, name')
      .eq('business_id', data.business_id);

    if (fetchError) {
      console.warn('Supabase check expense category duplicate error:', fetchError.message);
      return { success: false, error: fetchError.message };
    }

    const isDuplicate = ((existingRows as Array<{ id: string; name: string }>) || []).some(
      (c) => c.name?.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      return { success: false, error: 'Cette catégorie existe déjà.' };
    }

    const newId = `expcat_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
    const now = new Date().toISOString();

    const recordToInsert: ExpenseCategoryItem = {
      id: newId,
      business_id: data.business_id,
      name: trimmedName,
      is_active: true,
      created_at: now,
    };

    const { data: insertedRows, error: insertError } = await (client as any)
      .from('platform_expense_categories')
      .insert(recordToInsert)
      .select();

    if (insertError) {
      console.warn('Supabase insert expense category error:', insertError.message);
      return { success: false, error: insertError.message };
    }

    if (!insertedRows || insertedRows.length === 0) {
      console.warn('Supabase insert expense category: 0 rows returned');
      return { success: false, error: "L'insertion de la catégorie de dépense n'a retourné aucun enregistrement." };
    }

    const insertedCategory = insertedRows[0] as ExpenseCategoryItem;
    return { success: true, category: insertedCategory };
  } catch (err: any) {
    console.warn('Supabase insert expense category exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 3. Delete an expense category from platform_expense_categories in Supabase.
 * - Enforces strict verification that deletedRows.length > 0
 * - Does NOT delete existing expenses using this category
 */
export async function deleteExpenseCategory(
  categoryId: string
): Promise<{ success: boolean; error?: string }> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return { success: false, error: 'Configuration Supabase manquante' };
  }

  try {
    const client = getSupabase();
    const { data: deletedRows, error } = await (client as any)
      .from('platform_expense_categories')
      .delete()
      .eq('id', categoryId)
      .select();

    if (error) {
      console.warn('Supabase delete expense category error:', error.message);
      return { success: false, error: error.message };
    }

    if (!deletedRows || deletedRows.length === 0) {
      console.warn('Supabase delete expense category: 0 rows affected');
      return { success: false, error: 'Catégorie de dépense introuvable ou déjà supprimée.' };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Supabase delete expense category exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion lors de la suppression' };
  }
}

/**
 * ============================================================================
 * DELIVERY ZONES CRUD (platform_delivery_zones)
 * ============================================================================
 */

/**
 * 1. Fetch delivery zones for a business from platform_delivery_zones in Supabase,
 * ordered by name ascending.
 * Returns empty array if error or no credentials.
 */
export async function fetchDeliveryZonesForBusiness(
  businessId: string
): Promise<DeliveryZone[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return [];
  }

  try {
    const client = getSupabase();
    const { data, error } = await (client as any)
      .from('platform_delivery_zones')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });

    if (error) {
      console.warn('Supabase fetch delivery zones error:', error.message);
      return [];
    }

    return (data as DeliveryZone[]) || [];
  } catch (err: any) {
    console.warn('Supabase fetch delivery zones exception:', err?.message || err);
    return [];
  }
}

/**
 * 2. Insert a new delivery zone into platform_delivery_zones in Supabase.
 * - Generates an id TEXT: `zone_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`
 * - Inserts with strict verification insertedRows.length > 0
 */
export async function insertDeliveryZone(data: {
  business_id: string;
  name: string;
  fee: number;
  active?: boolean;
}): Promise<{ success: boolean; zone?: DeliveryZone; error?: string }> {
  const trimmedName = data.name?.trim();
  if (!trimmedName) {
    return { success: false, error: 'Le nom de la zone de livraison est requis.' };
  }

  const store = getStore();
  const newId = `zone_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
  const now = new Date().toISOString();

  const recordToInsert: DeliveryZone = {
    id: newId,
    business_id: data.business_id,
    name: trimmedName,
    fee: Number(data.fee) || 0,
    active: data.active !== undefined ? Boolean(data.active) : true,
  };

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.saveDeliveryZone(recordToInsert);
    return { success: true, zone: recordToInsert };
  }

  try {
    const client = getSupabase();
    const { data: insertedRows, error } = await (client as any)
      .from('platform_delivery_zones')
      .insert({
        ...recordToInsert,
        created_at: now,
        updated_at: now,
      })
      .select();

    if (error) {
      console.warn('Supabase insert delivery zone error:', error.message);
      return { success: false, error: error.message };
    }

    if (!insertedRows || insertedRows.length === 0) {
      console.warn('Supabase insert delivery zone: 0 rows returned');
      return { success: false, error: "L'insertion de la zone de livraison n'a retourné aucun enregistrement." };
    }

    const insertedZone = insertedRows[0] as DeliveryZone;
    store.saveDeliveryZone(insertedZone);
    return { success: true, zone: insertedZone };
  } catch (err: any) {
    console.warn('Supabase insert delivery zone exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 3. Update a delivery zone in platform_delivery_zones in Supabase.
 * - Updates data and updated_at with strict anti-false-success check (updatedRows.length > 0)
 */
export async function updateDeliveryZone(
  zoneId: string,
  data: Partial<Omit<DeliveryZone, 'id' | 'business_id'>>
): Promise<{ success: boolean; zone?: DeliveryZone; error?: string }> {
  const store = getStore();
  const now = new Date().toISOString();

  const updatePayload: any = {
    ...data,
    updated_at: now,
  };
  if (data.name !== undefined) {
    updatePayload.name = data.name.trim();
  }
  if (data.fee !== undefined) {
    updatePayload.fee = Number(data.fee);
  }

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.saveDeliveryZone({ id: zoneId, ...data } as any);
    const updated = store.deliveryZones.find((z) => z.id === zoneId);
    return { success: true, zone: updated };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_delivery_zones')
      .update(updatePayload)
      .eq('id', zoneId)
      .select();

    if (error) {
      console.warn('Supabase update delivery zone error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase update delivery zone: 0 rows affected');
      return { success: false, error: 'Zone de livraison introuvable ou mise à jour échouée.' };
    }

    const updatedZone = updatedRows[0] as DeliveryZone;
    store.saveDeliveryZone(updatedZone);
    return { success: true, zone: updatedZone };
  } catch (err: any) {
    console.warn('Supabase update delivery zone exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 4. Toggle active status of a delivery zone in platform_delivery_zones in Supabase.
 * - Updates active = !currentActive and updated_at with strict verification
 */
export async function toggleDeliveryZoneActive(
  zoneId: string,
  currentActive: boolean
): Promise<{ success: boolean; zone?: DeliveryZone; error?: string }> {
  const store = getStore();
  const nextActive = !currentActive;
  const now = new Date().toISOString();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.toggleDeliveryZoneActive(zoneId);
    const updated = store.deliveryZones.find((z) => z.id === zoneId);
    return { success: true, zone: updated };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_delivery_zones')
      .update({
        active: nextActive,
        updated_at: now,
      })
      .eq('id', zoneId)
      .select();

    if (error) {
      console.warn('Supabase toggle delivery zone active error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase toggle delivery zone active: 0 rows affected');
      return { success: false, error: 'Zone de livraison introuvable ou statut non modifié.' };
    }

    const updatedZone = updatedRows[0] as DeliveryZone;
    store.saveDeliveryZone(updatedZone);
    return { success: true, zone: updatedZone };
  } catch (err: any) {
    console.warn('Supabase toggle delivery zone active exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 5. Delete a delivery zone from platform_delivery_zones in Supabase.
 * - Enforces strict verification that deletedRows.length > 0
 */
export async function deleteDeliveryZone(
  zoneId: string
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.deleteDeliveryZone(zoneId);
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: deletedRows, error } = await (client as any)
      .from('platform_delivery_zones')
      .delete()
      .eq('id', zoneId)
      .select();

    if (error) {
      console.warn('Supabase delete delivery zone error:', error.message);
      return { success: false, error: error.message };
    }

    if (!deletedRows || deletedRows.length === 0) {
      console.warn('Supabase delete delivery zone: 0 rows affected');
      return { success: false, error: 'Zone de livraison introuvable ou déjà supprimée.' };
    }

    store.deleteDeliveryZone(zoneId);
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase delete delivery zone exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion lors de la suppression' };
  }
}

/**
 * ============================================================================
 * BUSINESS CRUD (platform_businesses)
 * ============================================================================
 */

/**
 * 1. Fetch a business by ID from platform_businesses in Supabase.
 * Returns null if error, no credentials, or not found (never returns fabricated data).
 */
export async function fetchBusinessById(
  businessId: string
): Promise<Business | null> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    return null;
  }

  try {
    const client = getSupabase();
    const { data, error } = await (client as any)
      .from('platform_businesses')
      .select('*')
      .eq('id', businessId)
      .maybeSingle();

    if (error) {
      console.warn('Supabase fetch business by id error:', error.message);
      return null;
    }

    if (!data) {
      return null;
    }

    return data as Business;
  } catch (err: any) {
    console.warn('Supabase fetch business by id exception:', err?.message || err);
    return null;
  }
}

/**
 * 2. Update business configuration/details in platform_businesses in Supabase.
 * - Enforces strict verification updatedRows.length > 0
 * - Automatically updates updated_at timestamp
 */
export async function updateBusinessConfig(
  businessId: string,
  data: Partial<Omit<Business, 'id'>>
): Promise<{ success: boolean; business?: Business; error?: string }> {
  const store = getStore();
  const now = new Date().toISOString();

  const updatePayload: any = {
    ...data,
    updated_at: now,
  };

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    if (data.config) {
      store.updateBusinessConfig(businessId, data.config, data);
    } else {
      store.updateBusinessConfig(businessId, {}, data);
    }
    const updated = store.businesses.find((b) => b.id === businessId);
    return { success: true, business: updated };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_businesses')
      .update(updatePayload)
      .eq('id', businessId)
      .select();

    if (error) {
      console.warn('Supabase update business error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase update business: 0 rows affected');
      return { success: false, error: 'Commerce introuvable ou mise à jour échouée.' };
    }

    const updatedBiz = updatedRows[0] as Business;
    if (updatedBiz.config) {
      store.updateBusinessConfig(businessId, updatedBiz.config, updatedBiz);
    } else {
      store.updateBusinessConfig(businessId, {}, updatedBiz);
    }
    return { success: true, business: updatedBiz };
  } catch (err: any) {
    console.warn('Supabase update business exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/* ==========================================================================
   AGENT ASSISTANT — PROJETS, DISCUSSIONS & MESSAGES (PERSISTANCE SUPABASE)
   ========================================================================== */

/**
 * 1. Récupère la liste des projets de l'assistant pour un commerce donné.
 */
export async function fetchAgentProjectsForBusiness(
  businessId: string,
  status?: 'active' | 'trashed'
): Promise<AgentProject[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const store = getStore();
    return store.agentProjects.filter((p) => {
      if (p.business_id !== businessId) return false;
      if (status) {
        return (p.status || 'active') === status;
      }
      return true;
    });
  }

  try {
    const client = getSupabase();
    let query = (client as any)
      .from('platform_agent_projects')
      .select('*')
      .eq('business_id', businessId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetchAgentProjects error:', error.message);
      return [];
    }

    return (data as AgentProject[]) || [];
  } catch (err: any) {
    console.warn('Supabase fetchAgentProjects exception:', err?.message || err);
    return [];
  }
}

/**
 * 2. Crée un nouveau projet pour l'assistant dans platform_agent_projects.
 */
export async function insertAgentProject(data: {
  business_id: string;
  name: string;
}): Promise<{ success: boolean; project?: AgentProject; error?: string }> {
  const store = getStore();
  const newId = `agproj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const recordToInsert: AgentProject = {
    id: newId,
    business_id: data.business_id,
    name: data.name.trim(),
    status: 'active',
    created_at: now,
  };

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.agentProjects.push(recordToInsert);
    return { success: true, project: recordToInsert };
  }

  try {
    const client = getSupabase();
    const { data: insertedRows, error } = await (client as any)
      .from('platform_agent_projects')
      .insert(recordToInsert)
      .select();

    if (error) {
      console.warn('Supabase insertAgentProject error:', error.message);
      return { success: false, error: error.message };
    }

    if (!insertedRows || insertedRows.length === 0) {
      console.warn('Supabase insertAgentProject: 0 rows returned');
      return { success: false, error: "L'insertion du projet n'a retourné aucun enregistrement." };
    }

    const insertedProject = insertedRows[0] as AgentProject;
    const existingIndex = store.agentProjects.findIndex((p) => p.id === insertedProject.id);
    if (existingIndex >= 0) {
      store.agentProjects[existingIndex] = insertedProject;
    } else {
      store.agentProjects.push(insertedProject);
    }

    return { success: true, project: insertedProject };
  } catch (err: any) {
    console.warn('Supabase insertAgentProject exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 3. Renomme un projet existant dans platform_agent_projects.
 */
export async function updateAgentProject(
  projectId: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();
  const trimmedName = name.trim();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.renameAgentProject(projectId, trimmedName);
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_agent_projects')
      .update({ name: trimmedName })
      .eq('id', projectId)
      .select();

    if (error) {
      console.warn('Supabase updateAgentProject error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase updateAgentProject: 0 rows affected');
      return { success: false, error: 'Projet introuvable ou mise à jour échouée.' };
    }

    store.renameAgentProject(projectId, trimmedName);
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase updateAgentProject exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 4. Met un projet en corbeille (soft delete, status = 'trashed') et détache ses conversations.
 */
export async function deleteAgentProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  const store = getStore();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const proj = store.agentProjects.find((p) => p.id === projectId);
    if (proj) {
      proj.status = 'trashed';
    }
    store.agentConversations.forEach((c) => {
      if (c.project_id === projectId) {
        c.project_id = null;
      }
    });
    return { success: true };
  }

  try {
    const client = getSupabase();

    // 1. Soft delete du projet
    const { data: updatedRows, error } = await (client as any)
      .from('platform_agent_projects')
      .update({ status: 'trashed' })
      .eq('id', projectId)
      .select();

    if (error) {
      console.warn('Supabase deleteAgentProject error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase deleteAgentProject: 0 rows affected');
      return { success: false, error: 'Projet introuvable ou mise en corbeille échouée.' };
    }

    // 2. Détache les conversations de ce projet en base
    await (client as any)
      .from('platform_agent_conversations')
      .update({ project_id: null })
      .eq('project_id', projectId);

    const proj = store.agentProjects.find((p) => p.id === projectId);
    if (proj) {
      proj.status = 'trashed';
    }
    store.agentConversations.forEach((c) => {
      if (c.project_id === projectId) {
        c.project_id = null;
      }
    });

    return { success: true };
  } catch (err: any) {
    console.warn('Supabase deleteAgentProject exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 4b. Restaure un projet mis en corbeille (status = 'active').
 */
export async function restoreAgentProject(projectId: string): Promise<{ success: boolean; error?: string }> {
  const store = getStore();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const proj = store.agentProjects.find((p) => p.id === projectId);
    if (proj) {
      proj.status = 'active';
    }
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_agent_projects')
      .update({ status: 'active' })
      .eq('id', projectId)
      .select();

    if (error) {
      console.warn('Supabase restoreAgentProject error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase restoreAgentProject: 0 rows affected');
      return { success: false, error: 'Projet introuvable ou restauration échouée.' };
    }

    const proj = store.agentProjects.find((p) => p.id === projectId);
    if (proj) {
      proj.status = 'active';
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase restoreAgentProject exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 4c. Supprime définitivement un projet de platform_agent_projects (hard delete).
 */
export async function deleteAgentProjectPermanently(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.deleteAgentProject(projectId);
    return { success: true };
  }

  try {
    const client = getSupabase();

    // 1. Détache toute conversation rattachée
    await (client as any)
      .from('platform_agent_conversations')
      .update({ project_id: null })
      .eq('project_id', projectId);

    // 2. Suppression physique du projet
    const { data: deletedRows, error } = await (client as any)
      .from('platform_agent_projects')
      .delete()
      .eq('id', projectId)
      .select();

    if (error) {
      console.warn('Supabase deleteAgentProjectPermanently error:', error.message);
      return { success: false, error: error.message };
    }

    if (!deletedRows || deletedRows.length === 0) {
      console.warn('Supabase deleteAgentProjectPermanently: 0 rows affected');
      return { success: false, error: 'Projet introuvable ou suppression définitive échouée.' };
    }

    store.deleteAgentProject(projectId);
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase deleteAgentProjectPermanently exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 5. Récupère la liste des conversations de l'assistant pour un commerce donné.
 */
export async function fetchAgentConversationsForBusiness(businessId: string): Promise<AgentConversation[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const store = getStore();
    return store.agentConversations.filter((c) => c.business_id === businessId);
  }

  try {
    const client = getSupabase();
    const { data, error } = await (client as any)
      .from('platform_agent_conversations')
      .select('*')
      .eq('business_id', businessId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchAgentConversations error:', error.message);
      return [];
    }

    return (data as AgentConversation[]) || [];
  } catch (err: any) {
    console.warn('Supabase fetchAgentConversations exception:', err?.message || err);
    return [];
  }
}

/**
 * 6. Crée une nouvelle conversation dans platform_agent_conversations.
 */
export async function insertAgentConversation(data: {
  business_id: string;
  project_id?: string | null;
  title: string;
}): Promise<{ success: boolean; conversation?: AgentConversation; error?: string }> {
  const store = getStore();
  const newId = `agconv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const recordToInsert: AgentConversation = {
    id: newId,
    business_id: data.business_id,
    project_id: data.project_id || null,
    title: data.title.trim(),
    status: 'active',
    created_at: now,
    updated_at: now,
  };

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.agentConversations.unshift(recordToInsert);
    return { success: true, conversation: recordToInsert };
  }

  try {
    const client = getSupabase();
    const { data: insertedRows, error } = await (client as any)
      .from('platform_agent_conversations')
      .insert(recordToInsert)
      .select();

    if (error) {
      console.warn('Supabase insertAgentConversation error:', error.message);
      return { success: false, error: error.message };
    }

    if (!insertedRows || insertedRows.length === 0) {
      console.warn('Supabase insertAgentConversation: 0 rows returned');
      return { success: false, error: "L'insertion de la conversation n'a retourné aucun enregistrement." };
    }

    const insertedConv = insertedRows[0] as AgentConversation;
    const existingIndex = store.agentConversations.findIndex((c) => c.id === insertedConv.id);
    if (existingIndex >= 0) {
      store.agentConversations[existingIndex] = insertedConv;
    } else {
      store.agentConversations.unshift(insertedConv);
    }

    return { success: true, conversation: insertedConv };
  } catch (err: any) {
    console.warn('Supabase insertAgentConversation exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 7. Met à jour une conversation (titre, projet assigné, statut actif/corbeille) dans platform_agent_conversations.
 */
export async function updateAgentConversation(
  conversationId: string,
  data: {
    title?: string;
    project_id?: string | null;
    status?: 'active' | 'trashed';
  }
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.title !== undefined) updatePayload.title = data.title.trim();
  if (data.project_id !== undefined) updatePayload.project_id = data.project_id;
  if (data.status !== undefined) updatePayload.status = data.status;

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const conv = store.agentConversations.find((c) => c.id === conversationId);
    if (conv) {
      if (data.title !== undefined) conv.title = data.title.trim();
      if (data.project_id !== undefined) conv.project_id = data.project_id;
      if (data.status !== undefined) conv.status = data.status;
      conv.updated_at = new Date().toISOString();
    }
    return { success: true };
  }

  try {
    const client = getSupabase();
    const { data: updatedRows, error } = await (client as any)
      .from('platform_agent_conversations')
      .update(updatePayload)
      .eq('id', conversationId)
      .select();

    if (error) {
      console.warn('Supabase updateAgentConversation error:', error.message);
      return { success: false, error: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn('Supabase updateAgentConversation: 0 rows affected');
      return { success: false, error: 'Discussion introuvable ou mise à jour échouée.' };
    }

    const updatedConv = updatedRows[0] as AgentConversation;
    const conv = store.agentConversations.find((c) => c.id === conversationId);
    if (conv) {
      Object.assign(conv, updatedConv);
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase updateAgentConversation exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 8. Supprime définitivement une conversation et ses messages dans platform_agent_conversations.
 */
export async function deleteAgentConversationPermanently(
  conversationId: string
): Promise<{ success: boolean; error?: string }> {
  const store = getStore();

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    store.deleteConversationPermanently(conversationId);
    return { success: true };
  }

  try {
    const client = getSupabase();

    // Suppression préalable des messages rattachés pour respecter l'intégrité référentielle
    await (client as any)
      .from('platform_agent_messages')
      .delete()
      .eq('conversation_id', conversationId);

    const { data: deletedRows, error } = await (client as any)
      .from('platform_agent_conversations')
      .delete()
      .eq('id', conversationId)
      .select();

    if (error) {
      console.warn('Supabase deleteAgentConversationPermanently error:', error.message);
      return { success: false, error: error.message };
    }

    if (!deletedRows || deletedRows.length === 0) {
      console.warn('Supabase deleteAgentConversationPermanently: 0 rows affected');
      return { success: false, error: 'Discussion introuvable ou suppression échouée.' };
    }

    store.deleteConversationPermanently(conversationId);
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase deleteAgentConversationPermanently exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}

/**
 * 9. Récupère tous les messages d'une discussion ordonnés par date de création.
 */
export async function fetchAgentMessagesForConversation(conversationId: string): Promise<AgentChatMessage[]> {
  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const store = getStore();
    return store.agentMessages.filter((m) => m.conversation_id === conversationId);
  }

  try {
    const client = getSupabase();
    const { data, error } = await (client as any)
      .from('platform_agent_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetchAgentMessages error:', error.message);
      return [];
    }

    return ((data || []) as any[]).map((row) => ({
      id: row.id,
      conversation_id: row.conversation_id,
      sender: row.sender as 'user' | 'assistant',
      text: row.content || row.text || '',
      attachments: row.attachments || undefined,
      created_at: row.created_at,
    }));
  } catch (err: any) {
    console.warn('Supabase fetchAgentMessages exception:', err?.message || err);
    return [];
  }
}

/**
 * 10. Insère un message (utilisateur ou assistant) dans platform_agent_messages.
 */
export async function insertAgentMessage(data: {
  conversation_id: string;
  sender: 'user' | 'assistant';
  content?: string;
  attachments?: any[];
}): Promise<{ success: boolean; message?: AgentChatMessage; error?: string }> {
  const store = getStore();
  const newId = `agmsg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const rawContent = data.content || (data as any).text || '';

  const recordToInsert = {
    id: newId,
    conversation_id: data.conversation_id,
    sender: data.sender,
    content: rawContent,
    attachments: data.attachments && data.attachments.length > 0 ? data.attachments : null,
    created_at: now,
  };

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasCredentials) {
    const msg = store.addAgentChatMessage(
      data.conversation_id,
      data.sender,
      rawContent,
      data.attachments
    );
    return { success: true, message: msg };
  }

  try {
    const client = getSupabase();
    const { data: insertedRows, error } = await (client as any)
      .from('platform_agent_messages')
      .insert(recordToInsert)
      .select();

    if (error) {
      console.warn('Supabase insertAgentMessage error:', error.message);
      return { success: false, error: error.message };
    }

    if (!insertedRows || insertedRows.length === 0) {
      console.warn('Supabase insertAgentMessage: 0 rows returned');
      return { success: false, error: "L'insertion du message n'a retourné aucun enregistrement." };
    }

    const insertedRow = insertedRows[0] as any;
    const formattedMessage: AgentChatMessage = {
      id: insertedRow.id,
      conversation_id: insertedRow.conversation_id,
      sender: insertedRow.sender as 'user' | 'assistant',
      text: insertedRow.content || insertedRow.text || '',
      attachments: insertedRow.attachments || undefined,
      created_at: insertedRow.created_at,
    };

    const existingMsgIndex = store.agentMessages.findIndex((m) => m.id === formattedMessage.id);
    if (existingMsgIndex >= 0) {
      store.agentMessages[existingMsgIndex] = formattedMessage;
    } else {
      store.agentMessages.push(formattedMessage);
    }

    // Mise à jour de la date de modification de la conversation
    const conv = store.agentConversations.find((c) => c.id === data.conversation_id);
    if (conv) {
      conv.updated_at = now;
      if ((conv.title === 'Nouvelle discussion' || !conv.title) && data.sender === 'user' && rawContent) {
        conv.title = rawContent.length > 30 ? rawContent.substring(0, 30) + '...' : rawContent;
      }
    }

    return { success: true, message: formattedMessage };
  } catch (err: any) {
    console.warn('Supabase insertAgentMessage exception:', err?.message || err);
    return { success: false, error: err?.message || 'Erreur de connexion à la base de données' };
  }
}




