import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../../../lib/supabaseClient';

const { width } = Dimensions.get('window');

export default function GuestDetailsScreen() {
  const router = useRouter();
  const { id: guestId } = useLocalSearchParams();
  const [guest, setGuest] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'bookings' | 'profile' | 'preferences'>('bookings');

  const [stats, setStats] = useState({
    totalBookings: 0,
    totalSpent: 0,
    averageSpent: 0,
    lastVisit: null as string | null,
  });

  const fetchGuestDetails = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: guestData, error: guestError } = await supabase
        .from('guests')
        .select('*')
        .eq('id', guestId)
        .single();

      if (guestError || !guestData) throw new Error('Guest not found');
      setGuest(guestData);

      const { data: userHotels } = await supabase
        .from('hotels')
        .select('id, name, city')
        .eq('owner_id', user.id);

      if (!userHotels || userHotels.length === 0) {
        setBookings([]);
        calculateStats([]);
        return;
      }

      const hotelIds = userHotels.map(h => h.id);

      const { data: roomTypes } = await supabase
        .from('room_types')
        .select('id, name, property_id')
        .in('property_id', hotelIds);

      if (!roomTypes || roomTypes.length === 0) {
        setBookings([]);
        calculateStats([]);
        return;
      }

      const roomTypeIds = roomTypes.map(rt => rt.id);

      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*')
        .eq('guest_id', guestId)
        .in('room_type_id', roomTypeIds)
        .order('created_at', { ascending: false });

      const enhancedBookings = (bookingsData || []).map(booking => {
        const roomType = roomTypes.find(rt => rt.id === booking.room_type_id);
        const hotel = userHotels.find(h => h.id === roomType?.property_id);

        return {
          ...booking,
          room_type: roomType || { name: 'Unknown Room', property_id: null },
          hotel: hotel || { name: 'Unknown Hotel', location: null },
        };
      });

      setBookings(enhancedBookings);
      calculateStats(enhancedBookings);
    } catch (error) {
      console.error('Error fetching guest details:', error);
      Alert.alert('Error', 'Failed to load guest details');
      router.back();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStats = (bookingsData: any[]) => {
    const total = bookingsData.length;
    const totalAmount = bookingsData.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
    const average = total > 0 ? totalAmount / total : 0;
    const lastBooking = bookingsData.length > 0 ? bookingsData[0].check_in_date : null;

    setStats({
      totalBookings: total,
      totalSpent: totalAmount,
      averageSpent: average,
      lastVisit: lastBooking,
    });
  };

  const updateGuestStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase.from('guests').update({ status: newStatus }).eq('id', guestId);
      if (error) throw error;

      setGuest((prev: any) => (prev ? { ...prev, status: newStatus } : null));
      Alert.alert('Success', 'Guest status updated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'vip':
        return { bg: '#f3e8ff', text: '#7c3aed' };
      case 'regular':
        return { bg: '#dbeafe', text: '#2563eb' };
      case 'new':
        return { bg: '#dcfce7', text: '#16a34a' };
      default:
        return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  const getBookingStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { bg: '#dcfce7', text: '#16a34a' };
      case 'pending':
        return { bg: '#fef3c7', text: '#d97706' };
      case 'checked-in':
        return { bg: '#dbeafe', text: '#2563eb' };
      case 'checked-out':
        return { bg: '#f1f5f9', text: '#64748b' };
      case 'cancelled':
        return { bg: '#fee2e2', text: '#dc2626' };
      default:
        return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    if (guestId) {
      fetchGuestDetails();
    }
  }, [guestId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGuestDetails();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading Guest Details...</Text>
      </View>
    );
  }

  if (!guest) {
    return (
      <View style={styles.loadingContainer}>
        <Icon name="account-off" size={64} color="#cbd5e1" />
        <Text style={styles.emptyTitle}>Guest not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back to Guests</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColors = getStatusColor(guest.status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backIcon} onPress={() => router.back()}>
          <Icon name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Guest Details</Text>
          <Text style={styles.subtitle}>Complete profile</Text>
        </View>
        <TouchableOpacity
          style={styles.menuIcon}
          onPress={() => {
            Alert.alert('Guest Actions', 'Select an action', [
              {
                text: guest.status === 'vip' ? 'Remove VIP Status' : 'Make VIP',
                onPress: () => updateGuestStatus(guest.status === 'vip' ? 'regular' : 'vip'),
              },
              { text: 'Edit Guest Info' },
              { text: 'Send Email' },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        >
          <Icon name="dots-vertical" size={24} color="#0f172a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>
              {guest.name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.guestName}>{guest.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                <Text style={[styles.statusText, { color: statusColors.text }]}>
                  {guest.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.contactInfo}>
              <View style={styles.contactRow}>
                <Icon name="email" size={16} color="#64748b" />
                <Text style={styles.contactText}>{guest.email}</Text>
              </View>
              {guest.phone && (
                <View style={styles.contactRow}>
                  <Icon name="phone" size={16} color="#64748b" />
                  <Text style={styles.contactText}>{guest.phone}</Text>
                </View>
              )}
              {guest.nationality && (
                <View style={styles.contactRow}>
                  <Icon name="map-marker" size={16} color="#64748b" />
                  <Text style={styles.contactText}>{guest.nationality}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.totalBookings}</Text>
              <Text style={styles.statLabel}>Total Bookings</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatCurrency(stats.totalSpent)}</Text>
              <Text style={styles.statLabel}>Total Spent</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatCurrency(stats.averageSpent)}</Text>
              <Text style={styles.statLabel}>Avg Booking</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatDate(stats.lastVisit)}</Text>
              <Text style={styles.statLabel}>Last Visit</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['bookings', 'profile', 'preferences'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'bookings' ? 'Bookings' : tab === 'profile' ? 'Profile' : 'Preferences'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'bookings' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Booking History</Text>
            {bookings.length > 0 ? (
              bookings.map(booking => {
                const statusColors = getBookingStatusColor(booking.status);
                return (
                  <View key={booking.id} style={styles.bookingCard}>
                    <View style={styles.bookingHeader}>
                      <View style={styles.bookingInfo}>
                        <Text style={styles.bookingHotel}>{booking.hotel.name}</Text>
                        <Text style={styles.bookingRoom}>{booking.room_type.name}</Text>
                        {booking.hotel.location && (
                          <Text style={styles.bookingLocation}>{booking.hotel.location}</Text>
                        )}
                      </View>
                      <View style={[styles.bookingStatus, { backgroundColor: statusColors.bg }]}>
                        <Text style={[styles.bookingStatusText, { color: statusColors.text }]}>
                          {booking.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.bookingDetails}>
                      <View style={styles.bookingDetailRow}>
                        <Text style={styles.bookingDetailLabel}>Check In</Text>
                        <Text style={styles.bookingDetailValue}>{formatDate(booking.check_in_date)}</Text>
                      </View>
                      <View style={styles.bookingDetailRow}>
                        <Text style={styles.bookingDetailLabel}>Check Out</Text>
                        <Text style={styles.bookingDetailValue}>{formatDate(booking.check_out_date)}</Text>
                      </View>
                      <View style={styles.bookingDetailRow}>
                        <Text style={styles.bookingDetailLabel}>Amount</Text>
                        <Text style={styles.bookingAmount}>{formatCurrency(booking.total_amount)}</Text>
                      </View>
                      <View style={styles.bookingDetailRow}>
                        <Text style={styles.bookingDetailLabel}>Booked On</Text>
                        <Text style={styles.bookingDetailValue}>{formatDateTime(booking.created_at)}</Text>
                      </View>
                    </View>

                    <View style={styles.bookingActions}>
                      <TouchableOpacity style={styles.bookingButton}>
                        <Icon name="eye" size={16} color="#1e3a8a" />
                        <Text style={styles.bookingButtonText}>View Details</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.bookingButton}>
                        <Icon name="file-document" size={16} color="#1e3a8a" />
                        <Text style={styles.bookingButtonText}>Invoice</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Icon name="calendar-blank" size={48} color="#cbd5e1" />
                <Text style={styles.emptyStateTitle}>No bookings found</Text>
                <Text style={styles.emptyStateText}>
                  This guest hasn't made any bookings yet
                </Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'profile' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{guest.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{guest.phone || 'Not provided'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{guest.address || 'Not provided'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nationality</Text>
                <Text style={styles.infoValue}>{guest.nationality || 'Not provided'}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Identification</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ID Type</Text>
                <Text style={[styles.infoValue, { textTransform: 'capitalize' }]}>
                  {guest.id_type || 'Not provided'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ID Number</Text>
                <Text style={styles.infoValue}>{guest.id_number || 'Not provided'}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Contact Name</Text>
                <Text style={styles.infoValue}>{guest.emergency_contact || 'Not provided'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Contact Phone</Text>
                <Text style={styles.infoValue}>{guest.emergency_phone || 'Not provided'}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>{formatDate(guest.created_at)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Updated</Text>
                <Text style={styles.infoValue}>{formatDateTime(guest.updated_at)}</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'preferences' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Special Requests</Text>
            <View style={styles.preferencesCard}>
              <Text style={styles.preferencesText}>
                {guest.special_requests || 'No special requests on file'}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Accommodation Preferences</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Room Preferences</Text>
                <Text style={styles.infoValue}>Not specified</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Dietary Requirements</Text>
                <Text style={styles.infoValue}>Not specified</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backIcon: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  menuIcon: {
    marginLeft: 16,
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 16,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  avatarTextLarge: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  guestName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  contactInfo: {
    gap: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#64748b',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: (width - 56) / 2,
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#1e3a8a',
  },
  tabText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#1e3a8a',
    fontWeight: '600',
  },
  tabContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
    marginTop: 8,
  },
  bookingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingHotel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  bookingRoom: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  bookingLocation: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  bookingStatus: {
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
    gap: 12,
    marginBottom: 16,
  },
  bookingDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bookingDetailLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  bookingDetailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0f172a',
  },
  bookingAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  bookingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  bookingButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1e3a8a',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#0f172a',
  },
  preferencesCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  preferencesText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 16,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});