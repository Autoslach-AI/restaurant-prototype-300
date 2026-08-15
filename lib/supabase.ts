import { createClient } from '@supabase/supabase-js';
import { AttendanceRecord } from './types';
import { getStore } from './store';

const DEFAULT_SUPABASE_URL = 'https://xyzcompany.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.s';

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!supabaseClient) {
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL.trim() !== '')
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : DEFAULT_SUPABASE_URL;
    const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() !== '')
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      : DEFAULT_SUPABASE_KEY;

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
 * Uploads a staff profile photo to Supabase Storage.
 * Uses the 'agent-attachments' bucket with subfolder 'staff-avatars/{businessId}/'.
 * Falls back to Data URL preview if Supabase keys are not provided.
 */
export async function uploadStaffAvatar(file: File | Blob, businessId: string): Promise<string> {
  const fileExt = (file instanceof File && file.name.split('.').pop()) || 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
  const filePath = `staff-avatars/${businessId}/${fileName}`;

  const hasCredentials =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (hasCredentials) {
    try {
      const client = getSupabase();
      const { data, error } = await client.storage
        .from('agent-attachments')
        .upload(filePath, file, { upsert: true, contentType: file.type || 'image/jpeg' });

      if (!error && data) {
        const { data: publicUrlData } = client.storage
          .from('agent-attachments')
          .getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      } else if (error) {
        console.warn('Supabase upload error:', error.message);
      }
    } catch (err) {
      console.warn('Supabase storage upload exception:', err);
    }
  }

  // Fallback to reading file as Data URL for instant preview & local persistence
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
    reader.readAsDataURL(file);
  });
}

/**
 * Attendance Supabase API helpers
 */
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
      .from('attendance')
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
  const localSaved = store.upsertAttendanceRecord(record);

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const isValidUrl = Boolean(rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')));
  const hasCredentials = isValidUrl && Boolean(rawKey);

  if (!hasCredentials) {
    return localSaved;
  }

  try {
    const client = getSupabase();
    const { data, error } = await (client as any)
      .from('attendance')
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
      return localSaved;
    }
    if (data) {
      store.upsertAttendanceRecord(data as AttendanceRecord);
      return data as AttendanceRecord;
    }
    return localSaved;
  } catch (err) {
    console.warn('Supabase upsert attendance exception:', err);
    return localSaved;
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
    let query = (client as any).from('staff').update({
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
    console.log('Supabase staff updated successfully:', updatedRows);
    return { success: true };
  } catch (err: any) {
    console.warn('Supabase update staff exception:', err);
    return { success: false, error: err?.message || 'Erreur lors de la mise à jour' };
  }
}

