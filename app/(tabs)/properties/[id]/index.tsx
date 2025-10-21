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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { propertyAPI, roomTypeAPI, Property, RoomType, getStatusColor } from '../../../../lib/property';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { supabase } from '../../../../lib/supabaseClient';

export default function PropertyDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const propertyId = id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId) {
      loadProperty();
      loadRoomTypes();
    }
  }, [propertyId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadProperty(), loadRoomTypes()]);
    setRefreshing(false);
  };

  const loadProperty = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await propertyAPI.getById(propertyId);
      setProperty(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load property');
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'Failed to load property',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRoomTypes = async () => {
    try {
      const data = await roomTypeAPI.getByPropertyId(propertyId);
      
      // Calculate real-time availability for each room type
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

      setRoomTypes(roomTypesWithAvailability);
    } catch (err: any) {
      console.error('Error loading room types:', err);
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

  const calculateRoomStats = () => {
    const totalRooms = roomTypes.reduce((sum, room) => sum + room.total_rooms, 0);
    const availableRooms = roomTypes.reduce(
      (sum, room) => sum + (room.available_rooms || 0),
      0
    );
    const occupancyRate =
      totalRooms > 0 ? Math.round(((totalRooms - availableRooms) / totalRooms) * 100) : 0;

    return { totalRooms, availableRooms, occupancyRate };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (time: string) => {
    return new Date(`1970-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusStyle = (status: string) => {
    const statusMap: { [key: string]: any } = {
      active: { backgroundColor: '#D1FAE5', color: '#065F46' },
      inactive: { backgroundColor: '#FEE2E2', color: '#991B1B' },
      pending_approval: { backgroundColor: '#FEF3C7', color: '#92400E' },
      suspended: { backgroundColor: '#FFEDD5', color: '#9A3412' },
    };
    return statusMap[status] || { backgroundColor: '#F3F4F6', color: '#1F2937' };
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Loading property details...</Text>
      </View>
    );
  }

  if (error || !property) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle" size={40} color="#EF4444" />
        </View>
        <Text style={styles.errorTitle}>Error Loading Property</Text>
        <Text style={styles.errorMessage}>{error || 'Property not found'}</Text>
        <View style={styles.errorActions}>
          <TouchableOpacity style={styles.retryButton} onPress={loadProperty}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Back to Properties</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const roomStats = calculateRoomStats();
  const images = property.images && property.images.length > 0 ? property.images : [];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{property.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Image Gallery */}
      {images.length > 0 && (
        <View style={styles.imageGallery}>
          <Image
            source={{ uri: images[activeImageIndex] }}
            style={styles.mainImage}
            resizeMode="cover"
          />
          {images.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbnailContainer}
            >
              {images.map((image, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setActiveImageIndex(index)}
                  style={[
                    styles.thumbnail,
                    index === activeImageIndex && styles.thumbnailActive,
                  ]}
                >
                  <Image source={{ uri: image }} style={styles.thumbnailImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Property Info */}
      <View style={styles.propertyInfo}>
        <View style={styles.propertyHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.propertyName}>{property.name}</Text>
            <View style={styles.badges}>
              <View style={[styles.statusBadge, getStatusStyle(property.status)]}>
                <Text style={[styles.statusText, { color: getStatusStyle(property.status).color }]}>
                  {property.status.replace('_', ' ')}
                </Text>
              </View>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{property.property_type}</Text>
              </View>
              {property.star_category && (
                <View style={styles.starBadge}>
                  <Text style={styles.starBadgeText}>{property.star_category}★</Text>
                </View>
              )}
            </View>
            <View style={styles.location}>
              <Ionicons name="location-outline" size={16} color="#6B7280" />
              <Text style={styles.locationText}>
                {property.city}, {property.state}
                {property.area && ` - ${property.area}`}
              </Text>
            </View>
          </View>
        </View>

        {property.rating && property.rating > 0 && (
          <View style={styles.rating}>
            {[...Array(5)].map((_, i) => (
              <Ionicons
                key={i}
                name={i < Math.floor(property.rating!) ? 'star' : 'star-outline'}
                size={20}
                color={i < Math.floor(property.rating!) ? '#FBBF24' : '#D1D5DB'}
              />
            ))}
            <Text style={styles.ratingText}>{property.rating}</Text>
            {property.reviews_count && (
              <Text style={styles.reviewsCount}>({property.reviews_count} reviews)</Text>
            )}
          </View>
        )}
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="bed-outline" size={24} color="#1E3A8A" />
          <Text style={styles.statValue}>{roomStats.totalRooms}</Text>
          <Text style={styles.statLabel}>Total Rooms</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="stats-chart-outline" size={24} color="#1E3A8A" />
          <Text style={styles.statValue}>{roomStats.occupancyRate}%</Text>
          <Text style={styles.statLabel}>Occupancy</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle-outline" size={24} color="#10B981" />
          <Text style={styles.statValue}>{roomStats.availableRooms}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="calendar-outline" size={24} color="#1E3A8A" />
          <Text style={styles.statValue}>{property.total_bookings || 0}</Text>
          <Text style={styles.statLabel}>Bookings</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowEditModal(true)}
        >
          <Ionicons name="create-outline" size={20} color="#1E3A8A" />
          <Text style={styles.actionButtonText}>Edit Property</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButtonPrimary}
          onPress={() => router.push(`/properties/${propertyId}/rooms` as any)}
        >
          <LinearGradient
            colors={['#1E3A8A', '#1E40AF']}
            style={styles.actionButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="business-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonPrimaryText}>Manage Rooms</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Description */}
      {property.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About This Property</Text>
          <Text style={styles.description}>{property.description}</Text>
        </View>
      )}

      {/* Room Types */}
      {roomTypes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Room Types</Text>
            <TouchableOpacity
              onPress={() => router.push(`/properties/${propertyId}/rooms` as any)}
            >
              <Text style={styles.sectionLink}>View All</Text>
            </TouchableOpacity>
          </View>

          {roomTypes.map((room) => (
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
                <Text style={styles.roomName}>{room.name}</Text>
                <Text style={styles.roomBedType}>{room.bed_type.replace('_', ' ')}</Text>
                <View style={styles.roomStats}>
                  <Text style={styles.roomPrice}>{formatCurrency(room.base_rate)}/night</Text>
                  <Text style={styles.roomAvailability}>
                    {room.available_rooms}/{room.total_rooms} available
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Contact Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.contactGrid}>
          {property.phone && (
            <View style={styles.contactItem}>
              <View style={styles.contactIcon}>
                <Ionicons name="call-outline" size={20} color="#1E3A8A" />
              </View>
              <View>
                <Text style={styles.contactLabel}>Phone</Text>
                <Text style={styles.contactValue}>{property.phone}</Text>
              </View>
            </View>
          )}

          {property.email && (
            <View style={styles.contactItem}>
              <View style={styles.contactIcon}>
                <Ionicons name="mail-outline" size={20} color="#1E3A8A" />
              </View>
              <View>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue}>{property.email}</Text>
              </View>
            </View>
          )}

          {property.website && (
            <View style={styles.contactItem}>
              <View style={styles.contactIcon}>
                <Ionicons name="globe-outline" size={20} color="#1E3A8A" />
              </View>
              <View>
                <Text style={styles.contactLabel}>Website</Text>
                <Text style={styles.contactValue}>{property.website}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.locationDetails}>
          <Text style={styles.locationAddress}>{property.address}</Text>
          <Text style={styles.locationCity}>
            {property.city}, {property.state} {property.pincode}
          </Text>
          {property.landmark && (
            <Text style={styles.locationLandmark}>Near {property.landmark}</Text>
          )}
        </View>
      </View>

      {/* Amenities */}
      {property.amenities && property.amenities.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amenities</Text>
          <View style={styles.amenitiesGrid}>
            {property.amenities.map((amenity, index) => (
              <View key={index} style={styles.amenityChip}>
                <Text style={styles.amenityText}>{amenity}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Policies */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Property Policies</Text>
        <View style={styles.policyGrid}>
          {property.check_in_time && property.check_out_time && (
            <>
              <View style={styles.policyItem}>
                <Text style={styles.policyLabel}>Check-in</Text>
                <Text style={styles.policyValue}>{formatTime(property.check_in_time)}</Text>
              </View>
              <View style={styles.policyItem}>
                <Text style={styles.policyLabel}>Check-out</Text>
                <Text style={styles.policyValue}>{formatTime(property.check_out_time)}</Text>
              </View>
            </>
          )}
          {property.security_deposit && property.security_deposit > 0 && (
            <View style={styles.policyItem}>
              <Text style={styles.policyLabel}>Security Deposit</Text>
              <Text style={styles.policyValue}>
                {formatCurrency(property.security_deposit)}
              </Text>
            </View>
          )}
          {property.cancellation_policy && (
            <View style={styles.policyItem}>
              <Text style={styles.policyLabel}>Cancellation Policy</Text>
              <Text style={styles.policyValue}>
                {property.cancellation_policy.replace('_', ' ')}
              </Text>
            </View>
          )}
        </View>

        {property.house_rules && (
          <View style={styles.houseRules}>
            <Text style={styles.houseRulesTitle}>House Rules</Text>
            <Text style={styles.houseRulesText}>{property.house_rules}</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
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
    backgroundColor: '#F9FAFB',
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
    backgroundColor: '#F9FAFB',
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
    justifyContent: 'space-between',
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
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  imageGallery: {
    backgroundColor: '#fff',
  },
  mainImage: {
    width: '100%',
    height: 300,
  },
  thumbnailContainer: {
    padding: 12,
  },
  thumbnail: {
    width: 80,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: '#1E3A8A',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  propertyInfo: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  propertyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  propertyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  starBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  starBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  ratingText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    fontWeight: '600',
  },
  reviewsCount: {
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  actionButtonPrimary: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    gap: 8,
  },
  actionButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  section: {
    padding: 16,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  roomImage: {
    width: 80,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  roomBedType: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  roomStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roomPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  roomAvailability: {
    fontSize: 12,
    color: '#6B7280',
  },
  contactGrid: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  locationDetails: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  locationAddress: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
  },
  locationCity: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  locationLandmark: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  amenityText: {
    fontSize: 12,
    color: '#374151',
  },
  policyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  policyItem: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  policyLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  policyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textTransform: 'capitalize',
  },
  houseRules: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  houseRulesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 8,
  },
  houseRulesText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 24,
  },
});