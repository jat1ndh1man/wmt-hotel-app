import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { roomTypeAPI, propertyAPI, storageAPI, RoomType, Property } from '../../../../../lib/property';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { supabase } from '../../../../../lib/supabaseClient';

interface BookingData {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  check_in_date: string;
  check_out_date: string;
  rooms_booked: number;
  total_amount: number;
  booking_status: string;
  created_at: string;
  special_requests?: string;
}

export default function RoomDetailScreen() {
  const router = useRouter();
  const { id, roomId } = useLocalSearchParams();
  const propertyId = id as string;
  const roomTypeId = roomId as string;

  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [removingImageIndex, setRemovingImageIndex] = useState<number | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    if (propertyId && roomTypeId) {
      loadData();
    }
  }, [propertyId, roomTypeId]);

  useEffect(() => {
    if (activeTab === 'bookings' && roomType && bookings.length === 0) {
      loadBookings();
    }
  }, [activeTab, roomType]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (activeTab === 'bookings') {
      await loadBookings();
    }
    setRefreshing(false);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const propertyData = await propertyAPI.getById(propertyId);
      setProperty(propertyData);

      const roomTypes = await roomTypeAPI.getByPropertyId(propertyId);
      const room = roomTypes.find((r) => r.id === roomTypeId);

      if (room) {
        const availableRooms = await calculateRoomAvailability(room.id, room.total_rooms);
        const updatedRoom = { ...room, available_rooms: availableRooms };
        setRoomType(updatedRoom);
      } else {
        throw new Error('Room type not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load room details');
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'Failed to load room details',
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

  const loadBookings = async () => {
    if (!roomType) return;

    try {
      setBookingsLoading(true);

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          guest_name,
          guest_email,
          guest_phone,
          check_in_date,
          check_out_date,
          rooms_booked,
          total_amount,
          booking_status,
          created_at,
          special_requests
        `)
        .eq('room_type_id', roomType.id)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        console.error('Error loading bookings:', bookingsError);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load bookings',
        });
        return;
      }

      setBookings(bookingsData || []);

      if (bookingsData && bookingsData.length > 0) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Loaded ${bookingsData.length} bookings`,
        });
      }
    } catch (error: any) {
      console.error('Error loading bookings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load bookings',
      });
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleImageUpload = async () => {
    if (!roomType) return;

    try {
      setUploadingImages(true);
      const uris = await storageAPI.pickMultipleImages();

      if (uris.length > 0) {
        const uploadedUrls: string[] = [];

        for (const uri of uris) {
          const url = await storageAPI.uploadImage(uri);
          uploadedUrls.push(url);
        }

        const existingImages = Array.isArray(roomType.images) ? roomType.images : [];
        const updatedImages = [...existingImages, ...uploadedUrls];

        await roomTypeAPI.update(roomType.id, { images: updatedImages });
        setRoomType({ ...roomType, images: updatedImages });

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Uploaded ${uploadedUrls.length} image(s)`,
        });
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to upload images',
      });
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveImage = async (index: number) => {
    if (!roomType || removingImageIndex !== null) return;

    setRemovingImageIndex(index);

    try {
      const existingImages = Array.isArray(roomType.images) ? roomType.images : [];
      const updatedImages = existingImages.filter((_, i) => i !== index);

      await roomTypeAPI.update(roomType.id, { images: updatedImages });
      setRoomType({ ...roomType, images: updatedImages });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Image removed successfully',
      });
    } catch (error) {
      console.error('Error removing image:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to remove image',
      });
    } finally {
      setRemovingImageIndex(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getBookingStatusStyle = (status: string) => {
    const statusMap: { [key: string]: any } = {
      confirmed: { backgroundColor: '#D1FAE5', color: '#065F46' },
      pending: { backgroundColor: '#FEF3C7', color: '#92400E' },
      cancelled: { backgroundColor: '#FEE2E2', color: '#991B1B' },
      checked_in: { backgroundColor: '#DBEAFE', color: '#1E3A8A' },
      checked_out: { backgroundColor: '#F3F4F6', color: '#374151' },
      no_show: { backgroundColor: '#FFEDD5', color: '#9A3412' },
    };
    return statusMap[status] || { backgroundColor: '#F3F4F6', color: '#1F2937' };
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Loading room details...</Text>
      </View>
    );
  }

  if (error || !roomType) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle" size={40} color="#EF4444" />
        </View>
        <Text style={styles.errorTitle}>Error Loading Room</Text>
        <Text style={styles.errorMessage}>{error || 'Room not found'}</Text>
        <View style={styles.errorActions}>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Room Information Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Room Information</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Bed Type</Text>
            <Text style={styles.infoValue}>{roomType.bed_type.replace('_', ' ')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Max Occupancy</Text>
            <Text style={styles.infoValue}>{roomType.max_occupancy} guests</Text>
          </View>
          {roomType.room_size && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Room Size</Text>
              <Text style={styles.infoValue}>{roomType.room_size}</Text>
            </View>
          )}
          {roomType.floor && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Floor</Text>
              <Text style={styles.infoValue}>{roomType.floor}</Text>
            </View>
          )}
        </View>

        {roomType.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.infoLabel}>Description</Text>
            <Text style={styles.description}>{roomType.description}</Text>
          </View>
        )}

        {roomType.facilities && roomType.facilities.length > 0 && (
          <View style={styles.facilitiesContainer}>
            <Text style={styles.infoLabel}>Facilities</Text>
            <View style={styles.facilitiesGrid}>
              {roomType.facilities.map((facility, index) => (
                <View key={index} style={styles.facilityChip}>
                  <Text style={styles.facilityText}>{facility}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Quick Actions Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push(`/properties/${propertyId}/rooms` as any)}
          >
            <Ionicons name="create-outline" size={24} color="#1E3A8A" />
            <Text style={styles.quickActionText}>Edit Room</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => Toast.show({ type: 'info', text1: 'Coming Soon', text2: 'Pricing management feature' })}
          >
            <Ionicons name="cash-outline" size={24} color="#1E3A8A" />
            <Text style={styles.quickActionText}>Update Pricing</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => Toast.show({ type: 'info', text1: 'Coming Soon', text2: 'Availability calendar feature' })}
          >
            <Ionicons name="calendar-outline" size={24} color="#1E3A8A" />
            <Text style={styles.quickActionText}>Manage Availability</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderBookingsTab = () => (
    <View style={styles.tabContent}>
      {bookingsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={40} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>No bookings found</Text>
          <Text style={styles.emptySubtitle}>
            There are no bookings for this room type yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item: booking }) => (
            <TouchableOpacity
              style={styles.bookingCard}
              onPress={() => router.push(`/bookings/${booking.id}` as any)}
            >
              <View style={styles.bookingHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingGuestName}>{booking.guest_name}</Text>
                  <Text style={styles.bookingEmail}>{booking.guest_email}</Text>
                </View>
                <View
                  style={[
                    styles.bookingStatusBadge,
                    getBookingStatusStyle(booking.booking_status),
                  ]}
                >
                  <Text
                    style={[
                      styles.bookingStatusText,
                      { color: getBookingStatusStyle(booking.booking_status).color },
                    ]}
                  >
                    {booking.booking_status.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              <View style={styles.bookingDetails}>
                <View style={styles.bookingDetailRow}>
                  <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                  <Text style={styles.bookingDetailText}>
                    Check-in: {formatDate(booking.check_in_date)}
                  </Text>
                </View>
                <View style={styles.bookingDetailRow}>
                  <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                  <Text style={styles.bookingDetailText}>
                    Check-out: {formatDate(booking.check_out_date)}
                  </Text>
                </View>
                <View style={styles.bookingDetailRow}>
                  <Ionicons name="bed-outline" size={16} color="#6B7280" />
                  <Text style={styles.bookingDetailText}>
                    Rooms: {booking.rooms_booked}
                  </Text>
                </View>
                <View style={styles.bookingDetailRow}>
                  <Ionicons name="cash-outline" size={16} color="#6B7280" />
                  <Text style={styles.bookingDetailText}>
                    {formatCurrency(booking.total_amount)}
                  </Text>
                </View>
              </View>

              {booking.special_requests && (
                <View style={styles.specialRequests}>
                  <Text style={styles.specialRequestsLabel}>Special requests:</Text>
                  <Text style={styles.specialRequestsText}>{booking.special_requests}</Text>
                </View>
              )}

              <View style={styles.bookingFooter}>
                <Text style={styles.bookingDate}>Booked: {formatDate(booking.created_at)}</Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.bookingsList}
        />
      )}

      {/* Bookings Summary */}
      {bookings.length > 0 && (
        <View style={styles.bookingsSummary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {bookings.filter((b) => b.booking_status === 'confirmed').length}
            </Text>
            <Text style={styles.summaryLabel}>Confirmed</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {bookings.filter((b) => b.booking_status === 'checked_in').length}
            </Text>
            <Text style={styles.summaryLabel}>Checked In</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {bookings.filter((b) => b.booking_status === 'pending').length}
            </Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {formatCurrency(bookings.reduce((sum, b) => sum + b.total_amount, 0))}
            </Text>
            <Text style={styles.summaryLabel}>Total Revenue</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderGalleryTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.galleryHeader}>
          <Text style={styles.cardTitle}>Room Gallery</Text>
          <TouchableOpacity
            style={styles.uploadImageButton}
            onPress={handleImageUpload}
            disabled={uploadingImages}
          >
            {uploadingImages ? (
              <ActivityIndicator size="small" color="#1E3A8A" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color="#1E3A8A" />
                <Text style={styles.uploadImageButtonText}>Upload</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.uploadArea}
          onPress={handleImageUpload}
          disabled={uploadingImages}
        >
          <Ionicons name="cloud-upload-outline" size={32} color="#9CA3AF" />
          <Text style={styles.uploadAreaText}>
            {uploadingImages ? 'Uploading...' : 'Tap to upload images'}
          </Text>
          <Text style={styles.uploadAreaSubtext}>PNG, JPG, JPEG up to 10MB each</Text>
        </TouchableOpacity>

        {Array.isArray(roomType.images) && roomType.images.length > 0 ? (
          <View style={styles.imageGrid}>
            {roomType.images.map((imageUrl, index) => (
              <View key={index} style={styles.imageContainer}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedImageIndex(index);
                    setImageViewerVisible(true);
                  }}
                >
                  <Image source={{ uri: imageUrl }} style={styles.galleryImage} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => handleRemoveImage(index)}
                  disabled={removingImageIndex === index}
                >
                  {removingImageIndex === index ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.noImages}>
            <Ionicons name="image-outline" size={40} color="#9CA3AF" />
            <Text style={styles.noImagesText}>No images uploaded</Text>
            <Text style={styles.noImagesSubtext}>
              Add photos to showcase this room type
            </Text>
          </View>
        )}

        {Array.isArray(roomType.images) && roomType.images.length > 0 && (
          <View style={styles.galleryTip}>
            <Ionicons name="information-circle-outline" size={20} color="#3B82F6" />
            <Text style={styles.galleryTipText}>
              The first image will be used as the main room photo
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{roomType.name}</Text>
          <Text style={styles.headerSubtitle}>
            {roomType.bed_type.replace('_', ' ')} • Max {roomType.max_occupancy} guests
          </Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.quickStats}>
        <View style={styles.quickStatItem}>
          <Ionicons name="cash-outline" size={24} color="#1E3A8A" />
          <Text style={styles.quickStatValue}>{formatCurrency(roomType.base_rate)}</Text>
          <Text style={styles.quickStatLabel}>Base Rate</Text>
        </View>

        <View style={styles.quickStatItem}>
          <Ionicons name="bed-outline" size={24} color="#1E3A8A" />
          <Text style={styles.quickStatValue}>{roomType.total_rooms}</Text>
          <Text style={styles.quickStatLabel}>Total Rooms</Text>
        </View>

        <View style={styles.quickStatItem}>
          <Ionicons name="checkmark-circle-outline" size={24} color="#10B981" />
          <Text style={styles.quickStatValue}>{roomType.available_rooms}</Text>
          <Text style={styles.quickStatLabel}>Available</Text>
        </View>

        <View style={styles.quickStatItem}>
          <Ionicons name="stats-chart-outline" size={24} color="#1E3A8A" />
          <Text style={styles.quickStatValue}>
            {roomType.total_rooms > 0
              ? Math.round(
                  ((roomType.total_rooms - roomType.available_rooms) / roomType.total_rooms) * 100
                )
              : 0}
            %
          </Text>
          <Text style={styles.quickStatLabel}>Occupancy</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['overview', 'bookings', 'gallery'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'bookings' && bookings.length > 0 && (
                <Text style={styles.tabBadge}> {bookings.length}</Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={styles.tabContentContainer}>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'bookings' && renderBookingsTab()}
        {activeTab === 'gallery' && renderGalleryTab()}
      </View>

      {/* Image Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerClose}
            onPress={() => setImageViewerVisible(false)}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>

          {Array.isArray(roomType.images) && roomType.images.length > 0 && (
            <Image
              source={{ uri: roomType.images[selectedImageIndex] }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}

          <View style={styles.imageViewerIndicator}>
            <Text style={styles.imageViewerIndicatorText}>
              {selectedImageIndex + 1} / {roomType.images?.length || 0}
            </Text>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIcon: {
    width: 80,
    height: 80,
    backgroundColor: '#FEE2E2',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
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
    textTransform: 'capitalize',
  },
  quickStats: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  quickStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#1E3A8A',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabButtonTextActive: {
    color: '#1E3A8A',
  },
  tabBadge: {
    fontSize: 12,
    color: '#1E3A8A',
  },
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  infoItem: {
    width: '47%',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    textTransform: 'capitalize',
  },
  descriptionContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginTop: 4,
  },
  facilitiesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  facilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  facilityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  facilityText: {
    fontSize: 12,
    color: '#374151',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E3A8A',
    marginTop: 8,
    textAlign: 'center',
  },
  bookingsList: {
    padding: 16,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingGuestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  bookingEmail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  bookingStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bookingStatusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  bookingDetails: {
    gap: 8,
    marginBottom: 12,
  },
  bookingDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookingDetailText: {
    fontSize: 13,
    color: '#374151',
  },
  specialRequests: {
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 12,
  },
  specialRequestsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  specialRequestsText: {
    fontSize: 13,
    color: '#374151',
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bookingDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  bookingsSummary: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  uploadImageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  uploadArea: {
    height: 150,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
  },
  uploadAreaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 8,
  },
  uploadAreaSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageContainer: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImages: {
    alignItems: 'center',
    padding: 40,
  },
  noImagesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
  },
  noImagesSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  galleryTip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  galleryTipText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 24,
    zIndex: 10,
  },
  imageViewerImage: {
    width: '100%',
    height: '80%',
  },
  imageViewerIndicator: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageViewerIndicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});