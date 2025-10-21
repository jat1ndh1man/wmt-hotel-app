import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { propertyAPI, roomTypeAPI, storageAPI, Property, RoomType } from '../../../../../lib/property';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { supabase } from '../../../../../lib/supabaseClient';

const facilitiesList = [
  'Air Conditioning', 'WiFi', 'LED TV', 'Mini Bar', 'Coffee Set',
  'Shower', 'Bathtub', 'Towels', 'Room Service', 'Balcony',
  'Safe', 'Hair Dryer', 'Iron', 'Telephone', 'Desk',
];

const bedTypes = [
  { value: 'single', label: 'Single Bed' },
  { value: 'double', label: 'Double Bed' },
  { value: 'queen', label: 'Queen Bed' },
  { value: 'king', label: 'King Bed' },
  { value: 'twin', label: 'Twin Beds' },
];

interface NewRoomData {
  name: string;
  bed_type: string;
  max_occupancy: number;
  room_size: string;
  total_rooms: number;
  base_rate: string;
  facilities: string[];
  description: string;
  images: string[];
}

export default function RoomManagementScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const propertyId = id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomType | null>(null);

  const [newRoomData, setNewRoomData] = useState<NewRoomData>({
    name: '',
    bed_type: '',
    max_occupancy: 1,
    room_size: '',
    total_rooms: 1,
    base_rate: '',
    facilities: [],
    description: '',
    images: [],
  });

  useEffect(() => {
    if (propertyId) {
      loadProperty();
      loadRoomTypes();
    }
  }, [propertyId, activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadProperty(), loadRoomTypes()]);
    setRefreshing(false);
  };

  const loadProperty = async () => {
    try {
      const data = await propertyAPI.getById(propertyId);
      setProperty(data);
    } catch (err: any) {
      console.error('Error loading property:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load property details',
      });
    }
  };

  const loadRoomTypes = async () => {
    try {
      setLoading(true);
      const data = await roomTypeAPI.getByPropertyId(propertyId);

      // Calculate real-time availability
      const roomTypesWithAvailability = await Promise.all(
        data.map(async (roomType) => {
          const availableRooms = await calculateRoomAvailability(
            roomType.id,
            roomType.total_rooms
          );
          return {
            ...roomType,
            available_rooms: availableRooms,
          };
        })
      );

      // Filter by status if needed
      let filtered = roomTypesWithAvailability;
      if (activeTab !== 'all') {
        filtered = roomTypesWithAvailability.filter((room) => room.status === activeTab);
      }

      setRoomTypes(filtered);
    } catch (err: any) {
      console.error('Error loading room types:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load room types',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateRoomAvailability = async (
    roomTypeId: string,
    totalRooms: number,
    checkDate: string | null = null
  ) => {
    try {
      const targetDate = checkDate || new Date().toISOString().split('T')[0];

      const { data: overlappingBookings, error: bookingError } = await supabase
        .from('bookings')
        .select('rooms_booked')
        .eq('room_type_id', roomTypeId)
        .in('booking_status', ['confirmed', 'checked_in'])
        .lte('check_in_date', targetDate)
        .gte('check_out_date', targetDate);

      if (bookingError) {
        console.error('Error checking bookings:', bookingError);
        return totalRooms;
      }

      const totalRoomsBooked =
        overlappingBookings?.reduce((sum: number, booking: any) => 
          sum + (booking.rooms_booked || 0), 0) || 0;
      const availableCount = Math.max(0, totalRooms - totalRoomsBooked);

      return availableCount;
    } catch (error) {
      console.error('Error calculating room availability:', error);
      return totalRooms;
    }
  };

  const calculateStats = () => {
    const totalRoomTypes = roomTypes.length;
    const totalRooms = roomTypes.reduce((sum, room) => sum + room.total_rooms, 0);
    const availableRooms = roomTypes.reduce(
      (sum, room) => sum + (room.available_rooms || 0),
      0
    );
    const avgRate =
      roomTypes.length > 0
        ? Math.round(roomTypes.reduce((sum, room) => sum + room.base_rate, 0) / roomTypes.length)
        : 0;

    return { totalRoomTypes, totalRooms, availableRooms, avgRate };
  };

  const filteredRooms = roomTypes.filter((room) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      room.name.toLowerCase().includes(searchLower) ||
      room.bed_type.toLowerCase().includes(searchLower)
    );
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const resetNewRoomData = () => {
    setNewRoomData({
      name: '',
      bed_type: '',
      max_occupancy: 1,
      room_size: '',
      total_rooms: 1,
      base_rate: '',
      facilities: [],
      description: '',
      images: [],
    });
    setEditingRoom(null);
  };

  const handleAddRoom = () => {
    resetNewRoomData();
    setShowAddRoomModal(true);
  };

  const handleEditRoom = (room: RoomType) => {
    setEditingRoom(room);
    setNewRoomData({
      name: room.name,
      bed_type: room.bed_type,
      max_occupancy: room.max_occupancy,
      room_size: room.room_size || '',
      total_rooms: room.total_rooms,
      base_rate: room.base_rate.toString(),
      facilities: room.facilities,
      description: room.description || '',
      images: room.images || [],
    });
    setShowAddRoomModal(true);
  };

  const handleSaveRoom = async () => {
    // Validation
    if (!newRoomData.name.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Room name is required' });
      return;
    }
    if (!newRoomData.bed_type) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Bed type is required' });
      return;
    }
    if (!newRoomData.base_rate) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Base rate is required' });
      return;
    }

    try {
      setSaving(true);

      const roomData: Omit<RoomType, 'id' | 'created_at' | 'updated_at'> = {
        property_id: propertyId,
        name: newRoomData.name.trim(),
        bed_type: newRoomData.bed_type,
        max_occupancy: newRoomData.max_occupancy,
        room_size: newRoomData.room_size.trim() || undefined,
        total_rooms: newRoomData.total_rooms,
        available_rooms: newRoomData.total_rooms,
        base_rate: parseInt(newRoomData.base_rate),
        facilities: newRoomData.facilities,
        description: newRoomData.description.trim() || undefined,
        images: newRoomData.images,
        status: 'active',
        floor: undefined,
      };

      if (editingRoom) {
        await roomTypeAPI.update(editingRoom.id, roomData);
        Toast.show({ type: 'success', text1: 'Success', text2: 'Room type updated!' });
      } else {
        await roomTypeAPI.create(roomData);
        Toast.show({ type: 'success', text1: 'Success', text2: 'Room type created!' });
      }

      setShowAddRoomModal(false);
      resetNewRoomData();
      loadRoomTypes();
    } catch (error: any) {
      console.error('Error saving room type:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save room type' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    try {
      await roomTypeAPI.delete(roomId);
      Toast.show({ type: 'success', text1: 'Success', text2: 'Room type deleted!' });
      loadRoomTypes();
    } catch (error: any) {
      console.error('Error deleting room type:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete room type' });
    }
  };

  const toggleFacility = (facility: string) => {
    setNewRoomData((prev) => ({
      ...prev,
      facilities: prev.facilities.includes(facility)
        ? prev.facilities.filter((f) => f !== facility)
        : [...prev.facilities, facility],
    }));
  };

  const handleImagePick = async () => {
    try {
      setUploadingImages(true);
      const uris = await storageAPI.pickMultipleImages();

      if (uris.length > 0) {
        const uploadedUrls: string[] = [];

        for (const uri of uris) {
          const url = await storageAPI.uploadImage(uri);
          uploadedUrls.push(url);
        }

        setNewRoomData((prev) => ({
          ...prev,
          images: [...prev.images, ...uploadedUrls],
        }));

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Uploaded ${uploadedUrls.length} image(s)`,
        });
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to upload images' });
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setNewRoomData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const stats = calculateStats();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBackButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Room Management</Text>
          <Text style={styles.headerSubtitle}>{property?.name}</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddRoom}>
          <LinearGradient
            colors={['#1E3A8A', '#1E40AF']}
            style={styles.addButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="grid-outline" size={24} color="#1E3A8A" />
            <Text style={styles.statValue}>{stats.totalRoomTypes}</Text>
            <Text style={styles.statLabel}>Room Types</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="bed-outline" size={24} color="#1E3A8A" />
            <Text style={styles.statValue}>{stats.totalRooms}</Text>
            <Text style={styles.statLabel}>Total Rooms</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#10B981" />
            <Text style={styles.statValue}>{stats.availableRooms}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={24} color="#1E3A8A" />
            <Text style={styles.statValue}>{formatCurrency(stats.avgRate)}</Text>
            <Text style={styles.statLabel}>Avg Rate</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search room types..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
          {['all', 'active', 'maintenance', 'inactive'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Room Types List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1E3A8A" />
            <Text style={styles.loadingText}>Loading room types...</Text>
          </View>
        ) : filteredRooms.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bed-outline" size={40} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>No room types found</Text>
            <Text style={styles.emptySubtitle}>
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Get started by adding your first room type'}
            </Text>
            {!searchTerm && (
              <TouchableOpacity style={styles.emptyButton} onPress={handleAddRoom}>
                <Text style={styles.emptyButtonText}>Add Room Type</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.roomsList}>
            {filteredRooms.map((room) => (
              <TouchableOpacity
                key={room.id}
                style={styles.roomCard}
                onPress={() =>
                  router.push(`/properties/${propertyId}/rooms/${room.id}` as any)
                }
              >
                {room.images && room.images.length > 0 && (
                  <Image
                    source={{ uri: room.images[0] }}
                    style={styles.roomImage}
                    resizeMode="cover"
                  />
                )}

                <View style={styles.roomInfo}>
                  <View style={styles.roomHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roomName}>{room.name}</Text>
                      <Text style={styles.roomBedType}>
                        {room.bed_type.replace('_', ' ')} • Max {room.max_occupancy} guests
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.roomStatus,
                        room.status === 'active' && styles.roomStatusActive,
                        room.status === 'maintenance' && styles.roomStatusMaintenance,
                        room.status === 'inactive' && styles.roomStatusInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roomStatusText,
                          room.status === 'active' && styles.roomStatusTextActive,
                          room.status === 'maintenance' && styles.roomStatusTextMaintenance,
                          room.status === 'inactive' && styles.roomStatusTextInactive,
                        ]}
                      >
                        {room.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.roomDetails}>
                    <View style={styles.roomDetailItem}>
                      <Text style={styles.roomDetailLabel}>Rate</Text>
                      <Text style={styles.roomDetailValue}>
                        {formatCurrency(room.base_rate)}/night
                      </Text>
                    </View>
                    <View style={styles.roomDetailItem}>
                      <Text style={styles.roomDetailLabel}>Rooms</Text>
                      <Text style={styles.roomDetailValue}>
                        {room.available_rooms}/{room.total_rooms}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.roomActions}>
                    <TouchableOpacity
                      style={styles.roomActionButton}
                      onPress={() => handleEditRoom(room)}
                    >
                      <Ionicons name="create-outline" size={18} color="#1E3A8A" />
                      <Text style={styles.roomActionText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.roomActionButton}
                      onPress={() =>
                        router.push(`/properties/${propertyId}/rooms/${room.id}` as any)
                      }
                    >
                      <Ionicons name="eye-outline" size={18} color="#1E3A8A" />
                      <Text style={styles.roomActionText}>View</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.roomActionButton, styles.roomActionButtonDanger]}
                      onPress={() => handleDeleteRoom(room.id, room.name)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      <Text style={[styles.roomActionText, styles.roomActionTextDanger]}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Add/Edit Room Modal */}
      <Modal
        visible={showAddRoomModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddRoomModal(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowAddRoomModal(false);
                resetNewRoomData();
              }}
            >
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingRoom ? 'Edit Room Type' : 'Add Room Type'}
            </Text>
            <TouchableOpacity onPress={handleSaveRoom} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#1E3A8A" />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Room Name */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Room Type Name *</Text>
              <TextInput
                style={styles.input}
                value={newRoomData.name}
                onChangeText={(text) => setNewRoomData((prev) => ({ ...prev, name: text }))}
                placeholder="Deluxe Room"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Bed Type */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Bed Type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {bedTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.bedTypeButton,
                      newRoomData.bed_type === type.value && styles.bedTypeButtonActive,
                    ]}
                    onPress={() =>
                      setNewRoomData((prev) => ({ ...prev, bed_type: type.value }))
                    }
                  >
                    <Text
                      style={[
                        styles.bedTypeText,
                        newRoomData.bed_type === type.value && styles.bedTypeTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Numbers */}
            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Max Occupancy *</Text>
                <TextInput
                  style={styles.input}
                  value={newRoomData.max_occupancy.toString()}
                  onChangeText={(text) =>
                    setNewRoomData((prev) => ({
                      ...prev,
                      max_occupancy: parseInt(text) || 1,
                    }))
                  }
                  placeholder="2"
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Total Rooms *</Text>
                <TextInput
                  style={styles.input}
                  value={newRoomData.total_rooms.toString()}
                  onChangeText={(text) =>
                    setNewRoomData((prev) => ({
                      ...prev,
                      total_rooms: parseInt(text) || 1,
                    }))
                  }
                  placeholder="10"
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Base Rate and Room Size */}
            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Base Rate (₹) *</Text>
                <TextInput
                  style={styles.input}
                  value={newRoomData.base_rate}
                  onChangeText={(text) =>
                    setNewRoomData((prev) => ({ ...prev, base_rate: text }))
                  }
                  placeholder="3999"
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Room Size</Text>
                <TextInput
                  style={styles.input}
                  value={newRoomData.room_size}
                  onChangeText={(text) =>
                    setNewRoomData((prev) => ({ ...prev, room_size: text }))
                  }
                  placeholder="350 sq ft"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Description */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.textArea}
                value={newRoomData.description}
                onChangeText={(text) =>
                  setNewRoomData((prev) => ({ ...prev, description: text }))
                }
                placeholder="Describe the room features..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Images */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Room Images</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={handleImagePick}
                disabled={uploadingImages}
              >
                <Ionicons name="cloud-upload-outline" size={24} color="#1E3A8A" />
                <Text style={styles.uploadButtonText}>
                  {uploadingImages ? 'Uploading...' : 'Upload Images'}
                </Text>
              </TouchableOpacity>

              {newRoomData.images.length > 0 && (
                <View style={styles.imageGrid}>
                  {newRoomData.images.map((image, index) => (
                    <View key={index} style={styles.imageContainer}>
                      <Image source={{ uri: image }} style={styles.uploadedImage} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeImage(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Facilities */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Room Facilities</Text>
              <View style={styles.facilitiesGrid}>
                {facilitiesList.map((facility) => (
                  <TouchableOpacity
                    key={facility}
                    style={[
                      styles.facilityChip,
                      newRoomData.facilities.includes(facility) && styles.facilityChipActive,
                    ]}
                    onPress={() => toggleFacility(facility)}
                  >
                    <Text
                      style={[
                        styles.facilityText,
                        newRoomData.facilities.includes(facility) && styles.facilityTextActive,
                      ]}
                    >
                      {facility}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginLeft: 12,
  },
  addButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#111827',
  },
  tabsContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: '#1E3A8A',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    backgroundColor: '#F3F4F6',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  roomsList: {
    padding: 16,
    gap: 16,
  },
  roomCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  roomImage: {
    width: '100%',
    height: 150,
  },
  roomInfo: {
    padding: 16,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  roomBedType: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  roomStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roomStatusActive: {
    backgroundColor: '#D1FAE5',
  },
  roomStatusMaintenance: {
    backgroundColor: '#FEF3C7',
  },
  roomStatusInactive: {
    backgroundColor: '#FEE2E2',
  },
  roomStatusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  roomStatusTextActive: {
    color: '#065F46',
  },
  roomStatusTextMaintenance: {
    color: '#92400E',
  },
  roomStatusTextInactive: {
    color: '#991B1B',
  },
  roomDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  roomDetailItem: {
    alignItems: 'center',
  },
  roomDetailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  roomDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  roomActions: {
    flexDirection: 'row',
    gap: 8,
  },
  roomActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 4,
  },
  roomActionButtonDanger: {
    borderColor: '#FEE2E2',
  },
  roomActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  roomActionTextDanger: {
    color: '#EF4444',
  },
  bottomPadding: {
    height: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCancel: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  bedTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  bedTypeButtonActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  bedTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  bedTypeTextActive: {
    color: '#fff',
  },
  uploadButton: {
    height: 120,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A8A',
    marginTop: 8,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  imageContainer: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  facilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  facilityChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  facilityChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  facilityText: {
    fontSize: 12,
    color: '#374151',
  },
  facilityTextActive: {
    color: '#fff',
  },
});