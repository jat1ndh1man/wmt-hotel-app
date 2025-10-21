import { supabase } from './supabaseClient';

export interface Property {
  id: string;
  name: string;
  property_type: string;
  description?: string;
  short_description?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  area?: string;
  landmark?: string;
  latitude?: string;
  longitude?: string;
  phone: string;
  email: string;
  website?: string;
  amenities: string[];
  check_in_time: string;
  check_out_time: string;
  house_rules?: string;
  security_deposit?: number;
  cancellation_policy?: string;
  images: string[];
  owner_documents: string[];
  price: number;
  star_category?: string;
  status: string;
  verification_status?: string;
  rating?: number;
  reviews_count?: number;
  total_revenue?: number;
  total_bookings?: number;
  repeat_guests?: number;
  policies?: Record<string, boolean>;
  created_at?: string;
  updated_at?: string;
}

export interface RoomType {
  id: string;
  property_id: string;
  name: string;
  bed_type: string;
  max_occupancy: number;
  room_size?: string;
  total_rooms: number;
  available_rooms: number;
  base_rate: number;
  facilities: string[];
  description?: string;
  images: string[];
  status: string;
  floor?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PropertyFormData extends Omit<Property, 'id' | 'created_at' | 'updated_at' | 'status' | 'verification_status'> {}

class PropertyAPI {
  async getAll(status?: string): Promise<Property[]> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('hotels')
        .select('*')
        .eq('owner_id', user.id);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching properties:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Property> {
    try {
      const { data, error } = await supabase
        .from('hotels')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching property:', error);
      throw error;
    }
  }

  async create(propertyData: Partial<Property>): Promise<Property> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('hotels')
        .insert([{
          ...propertyData,
          owner_id: user.id,
          status: 'pending_approval',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating property:', error);
      throw error;
    }
  }

  async createFromForm(formData: PropertyFormData): Promise<Property> {
    const propertyData: Partial<Property> = {
      name: formData.name,
      property_type: formData.property_type,
      description: formData.description,
      short_description: formData.short_description,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      country: formData.country || 'India',
      pincode: formData.pincode,
      area: formData.area,
      landmark: formData.landmark,
      latitude: formData.latitude,
      longitude: formData.longitude,
      phone: formData.phone,
      email: formData.email,
      website: formData.website,
      amenities: formData.amenities,
      check_in_time: formData.check_in_time,
      check_out_time: formData.check_out_time,
      house_rules: formData.house_rules,
      security_deposit: formData.security_deposit ? parseInt(formData.security_deposit) : undefined,
      cancellation_policy: formData.cancellation_policy,
      images: formData.images,
      owner_documents: formData.owner_documents,
      price: parseInt(formData.price),
      star_category: formData.star_category,
      policies: formData.policies,
    };

    return this.create(propertyData);
  }

  async update(id: string, updates: Partial<Property>): Promise<Property> {
    try {
      const { data, error } = await supabase
        .from('hotels')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error updating property:', error);
      throw error;
    }
  }

  async updateStatus(id: string, status: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('hotels')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating property status:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('hotels')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting property:', error);
      throw error;
    }
  }

  async getStats(): Promise<{
    totalProperties: number;
    activeProperties: number;
    totalRooms: number;
    availableRooms: number;
    occupancyRate: number;
  }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      const { data: properties, error: propertiesError } = await supabase
        .from('hotels')
        .select('id, status')
        .eq('owner_id', user.id);

      if (propertiesError) throw propertiesError;

      const propertyIds = properties?.map(p => p.id) || [];
      const totalProperties = properties?.length || 0;
      const activeProperties = properties?.filter(p => p.status === 'active').length || 0;

      if (propertyIds.length === 0) {
        return {
          totalProperties: 0,
          activeProperties: 0,
          totalRooms: 0,
          availableRooms: 0,
          occupancyRate: 0,
        };
      }

      const { data: roomTypes, error: roomError } = await supabase
        .from('room_types')
        .select('total_rooms, available_rooms')
        .in('property_id', propertyIds);

      if (roomError) throw roomError;

      const totalRooms = roomTypes?.reduce((sum, room) => sum + room.total_rooms, 0) || 0;
      const availableRooms = roomTypes?.reduce((sum, room) => sum + room.available_rooms, 0) || 0;
      const occupancyRate = totalRooms > 0 ? Math.round(((totalRooms - availableRooms) / totalRooms) * 100) : 0;

      return {
        totalProperties,
        activeProperties,
        totalRooms,
        availableRooms,
        occupancyRate,
      };
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }
}

class RoomTypeAPI {
  async getByPropertyId(propertyId: string): Promise<RoomType[]> {
    try {
      const { data, error } = await supabase
        .from('room_types')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching room types:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<RoomType> {
    try {
      const { data, error } = await supabase
        .from('room_types')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching room type:', error);
      throw error;
    }
  }

  async create(roomData: Omit<RoomType, 'id' | 'created_at' | 'updated_at'>): Promise<RoomType> {
    try {
      const { data, error } = await supabase
        .from('room_types')
        .insert([{
          ...roomData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating room type:', error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<RoomType>): Promise<RoomType> {
    try {
      const { data, error } = await supabase
        .from('room_types')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error updating room type:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('room_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting room type:', error);
      throw error;
    }
  }

  async getPricingRules(roomTypeId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('pricing_rules')
        .select('*')
        .eq('room_type_id', roomTypeId)
        .order('priority', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching pricing rules:', error);
      return [];
    }
  }

  async createPricingRule(ruleData: any): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('pricing_rules')
        .insert([ruleData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating pricing rule:', error);
      throw error;
    }
  }

  async deletePricingRule(ruleId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('pricing_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting pricing rule:', error);
      throw error;
    }
  }
}

class StorageAPI {
  async uploadImage(file: any, bucket: string = 'property-images'): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(7)}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  async uploadDocument(file: any, bucket: string = 'property-documents'): Promise<string> {
    return this.uploadImage(file, bucket);
  }
}

export const propertyAPI = new PropertyAPI();
export const roomTypeAPI = new RoomTypeAPI();
export const storageAPI = new StorageAPI();

export const getMainImage = (property: Property): string | null => {
  return property.images && property.images.length > 0 ? property.images[0] : null;
};

export const getStatusColor = (status: string): string => {
  const colors: { [key: string]: string } = {
    active: 'bg-green-500/10 text-green-700 border-green-200',
    inactive: 'bg-red-500/10 text-red-700 border-red-200',
    pending_approval: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
    suspended: 'bg-orange-500/10 text-orange-700 border-orange-200',
    maintenance: 'bg-blue-500/10 text-blue-700 border-blue-200',
  };
  return colors[status] || 'bg-gray-500/10 text-gray-700 border-gray-200';
};

export const getVerificationStatusColor = (status: string): string => {
  const colors: { [key: string]: string } = {
    verified: 'bg-green-500/10 text-green-700',
    pending: 'bg-yellow-500/10 text-yellow-700',
    rejected: 'bg-red-500/10 text-red-700',
  };
  return colors[status] || 'bg-gray-500/10 text-gray-700';
};