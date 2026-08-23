import { createClient } from '@supabase/supabase-js';
import { AttendanceRecord, Category, Customer, CustomerMessage, Order, OrderItem, OrderStatus, PaymentStatus, Product, Staff, StaffPermissions } from './types';
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
  data: { name: string; email: string; phone?: string }
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
    const { data, error } = await (client as any)
      .from('platform_customers')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch customers error:', error.message);
      return [];
    }

    return (data as Customer[]) || [];
  } catch (err: any) {
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
    const { data, error } = await (client as any)
      .from('platform_orders')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch orders error:', error.message);
      return [];
    }

    return (data as Order[]) || [];
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
