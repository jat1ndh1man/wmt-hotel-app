import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  RefreshControl,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { supabase } from '../../../lib/supabaseClient';

interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface RoomType {
  id: string;
  name: string;
  base_rate: number;
}

interface Property {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface RefundRequest {
  id: string;
  booking_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'failed';
  amount_requested_to_refund: number;
}

interface Booking {
  id: string;
  guest_id: string;
  property_id: string;
  room_type_id: string;
  check_in_date: string;
  check_in_time: string;
  check_out_date: string;
  check_out_time: string;
  adults: number;
  children: number;
  rooms_booked: number;
  status: 'pending' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';
  booking_status?: string;
  payment_status: 'pending' | 'partial' | 'paid' | 'pay-at-hotel';
  total_amount: number;
  advance_amount?: number;
  special_requests?: string;
  created_at: string;
  guest?: Guest;
  room_type?: RoomType;
  property?: Property;
  refund_request?: RefundRequest;
}

export default function BookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    checkInsToday: 0,
    checkOutsToday: 0,
  });

  useEffect(() => {
    loadBookings();
    loadStats();
  }, [activeTab]);

  useEffect(() => {
    filterBookings();
  }, [bookings, searchTerm, dateRange]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBookings(), loadStats()]);
    setRefreshing(false);
  }, [activeTab]);

  const filterBookings = () => {
    let filtered = [...bookings];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (booking) =>
          booking.guest?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          booking.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          booking.guest?.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Date range filter
    if (dateRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filtered = filtered.filter((booking) => {
        const checkIn = new Date(booking.check_in_date);
        const checkOut = new Date(booking.check_out_date);

        switch (dateRange) {
          case 'today':
            return (
              checkIn.toDateString() === today.toDateString() ||
              checkOut.toDateString() === today.toDateString() ||
              (checkIn <= today && checkOut >= today)
            );
          case 'week':
            const weekFromNow = new Date(today);
            weekFromNow.setDate(weekFromNow.getDate() + 7);
            return checkIn >= today && checkIn <= weekFromNow;
          case 'month':
            const monthFromNow = new Date(today);
            monthFromNow.setMonth(monthFromNow.getMonth() + 1);
            return checkIn >= today && checkIn <= monthFromNow;
          default:
            return true;
        }
      });
    }

    setFilteredBookings(filtered);
  };

  const loadBookings = async () => {
    try {
      setLoading(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Get user's room types
      const { data: userRoomTypes, error: roomTypesError } = await supabase
        .from('room_types')
        .select('id, property_id, name, base_rate')
        .in(
          'property_id',
          (
            await supabase.from('hotels').select('id').eq('owner_id', user.id)
          ).data?.map((p) => p.id) || []
        );

      if (roomTypesError || !userRoomTypes || userRoomTypes.length === 0) {
        setBookings([]);
        return;
      }

      const roomTypeIds = userRoomTypes.map((rt) => rt.id);

      // Fetch bookings
      let query = supabase
        .from('bookings')
        .select('*')
        .in('room_type_id', roomTypeIds)
        .order('created_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }

      const { data: bookingsData, error: bookingsError } = await query;

      if (bookingsError) throw bookingsError;

      if (bookingsData && bookingsData.length > 0) {
        const bookingIds = bookingsData.map((b) => b.id);
        const guestIds = [...new Set(bookingsData.map((b) => b.guest_id).filter(Boolean))];
        const propertyIds = [...new Set(userRoomTypes.map((rt) => rt.property_id))];

        // Fetch related data
        const [guestsResult, propertiesResult, bookingStatusResult, refundRequestsResult] =
          await Promise.all([
            guestIds.length > 0
              ? supabase.from('guests').select('*').in('id', guestIds)
              : { data: [] },
            propertyIds.length > 0
              ? supabase.from('hotels').select('id, name, city, state').in('id', propertyIds)
              : { data: [] },
            supabase
              .from('booking_status')
              .select('*')
              .in('booking_id', bookingIds)
              .order('created_at', { ascending: false }),
            supabase
              .from('refund_requests')
              .select('id, booking_id, status, amount_requested_to_refund')
              .in('booking_id', bookingIds),
          ]);

        const guestsMap = new Map((guestsResult.data || []).map((g) => [g.id, g]));
        const propertiesMap = new Map((propertiesResult.data || []).map((p) => [p.id, p]));
        const roomTypesMap = new Map(userRoomTypes.map((r) => [r.id, r]));
        const statusMap = new Map((bookingStatusResult.data || []).map((s) => [s.booking_id, s]));
        const refundMap = new Map(
          (refundRequestsResult.data || []).map((r) => [r.booking_id, r])
        );

        const bookingsWithRelations = bookingsData.map((booking) => {
          const roomType = roomTypesMap.get(booking.room_type_id);
          const property = roomType ? propertiesMap.get(roomType.property_id) : null;
          const bookingStatus = statusMap.get(booking.id);
          const refundRequest = refundMap.get(booking.id);
          const currentStatus = bookingStatus?.status || booking.status;

          return {
            ...booking,
            status: currentStatus,
            guest: guestsMap.get(booking.guest_id) || null,
            property: property || null,
            room_type: roomType || null,
            refund_request: refundRequest || null,
          };
        });

        setBookings(bookingsWithRelations);
      } else {
        setBookings([]);
      }
    } catch (error: any) {
      console.error('Error loading bookings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load bookings',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const { data: userRoomTypes } = await supabase
        .from('room_types')
        .select('id')
        .in(
          'property_id',
          (
            await supabase.from('hotels').select('id').eq('owner_id', user.id)
          ).data?.map((p) => p.id) || []
        );

      if (!userRoomTypes || userRoomTypes.length === 0) {
        setStats({
          totalBookings: 0,
          pendingBookings: 0,
          checkInsToday: 0,
          checkOutsToday: 0,
        });
        return;
      }

      const roomTypeIds = userRoomTypes.map((rt) => rt.id);
      const today = new Date().toISOString().split('T')[0];

      const [allBookings, pendingBookings, checkInsToday, checkOutsToday] = await Promise.all([
        supabase.from('bookings').select('id', { count: 'exact' }).in('room_type_id', roomTypeIds),
        supabase
          .from('bookings')
          .select('id', { count: 'exact' })
          .in('room_type_id', roomTypeIds)
          .eq('status', 'pending'),
        supabase
          .from('bookings')
          .select('id', { count: 'exact' })
          .in('room_type_id', roomTypeIds)
          .eq('check_in_date', today),
        supabase
          .from('bookings')
          .select('id', { count: 'exact' })
          .in('room_type_id', roomTypeIds)
          .eq('check_out_date', today),
      ]);

      setStats({
        totalBookings: allBookings.count || 0,
        pendingBookings: pendingBookings.count || 0,
        checkInsToday: checkInsToday.count || 0,
        checkOutsToday: checkOutsToday.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      // Update booking_status table
      await supabase.from('booking_status').upsert(
        {
          booking_id: bookingId,
          status: newStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'booking_id' }
      );

      // Update bookings table
      await supabase
        .from('bookings')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', bookingId);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Booking status updated to ${newStatus}`,
      });

      loadBookings();
      loadStats();
    } catch (error) {
      console.error('Error updating booking:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update booking status',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusStyle = (status: string) => {
    const statusMap: { [key: string]: any } = {
      confirmed: { backgroundColor: '#D1FAE5', color: '#065F46' },
      pending: { backgroundColor: '#FEF3C7', color: '#92400E' },
      'checked-in': { backgroundColor: '#DBEAFE', color: '#1E3A8A' },
      'checked-out': { backgroundColor: '#F3F4F6', color: '#374151' },
      cancelled: { backgroundColor: '#FEE2E2', color: '#991B1B' },
    };
    return statusMap[status] || { backgroundColor: '#F3F4F6', color: '#1F2937' };
  };

  const renderBookingCard = ({ item: booking }: { item: Booking }) => (
    <TouchableOpacity
      style={styles.bookingCard}
      onPress={() => router.push(`/bookings/${booking.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.bookingHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.guestName}>{booking.guest?.name || 'Unknown Guest'}</Text>
          <Text style={styles.guestEmail}>{booking.guest?.email}</Text>
        </View>
        <View style={[styles.statusBadge, getStatusStyle(booking.status)]}>
          <Text style={[styles.statusText, { color: getStatusStyle(booking.status).color }]}>
            {booking.status?.replace('-', ' ')}
          </Text>
        </View>
      </View>

      {booking.refund_request && (
        <View style={styles.refundBanner}>
          <Ionicons name="alert-circle" size={16} color="#F59E0B" />
          <Text style={styles.refundText}>
            Refund {booking.refund_request.status} - {formatCurrency(booking.refund_request.amount_requested_to_refund)}
          </Text>
        </View>
      )}

      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="business-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>{booking.property?.name || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="bed-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {booking.room_type?.name} • {booking.rooms_booked} room(s)
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {formatDate(booking.check_in_date)} - {formatDate(booking.check_out_date)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="people-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {booking.adults} adult{booking.adults !== 1 ? 's' : ''}, {booking.children} children
          </Text>
        </View>
      </View>

      <View style={styles.bookingFooter}>
        <View>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.amount}>{formatCurrency(booking.total_amount)}</Text>
        </View>
        <View style={styles.paymentBadge}>
          <Text style={styles.paymentText}>{booking.payment_status}</Text>
        </View>
      </View>

      {booking.status === 'pending' && (
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.approveButton}
            onPress={(e) => {
              e.stopPropagation();
              updateBookingStatus(booking.id, 'confirmed');
            }}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.approveButtonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={(e) => {
              e.stopPropagation();
              updateBookingStatus(booking.id, 'cancelled');
            }}
          >
            <Ionicons name="close-circle" size={18} color="#fff" />
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Loading bookings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bookings</Text>
          <Text style={styles.headerSubtitle}>Manage guest reservations</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/bookings/new' as any)}
        >
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

      {/* Stats Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsContainer}
        contentContainerStyle={styles.statsContent}
      >
        <View style={styles.statCard}>
          <Ionicons name="calendar-outline" size={24} color="#1E3A8A" />
          <Text style={styles.statValue}>{stats.totalBookings}</Text>
          <Text style={styles.statLabel}>Total Bookings</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{stats.pendingBookings}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="arrow-down-circle-outline" size={24} color="#10B981" />
          <Text style={styles.statValue}>{stats.checkInsToday}</Text>
          <Text style={styles.statLabel}>Check-ins Today</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="arrow-up-circle-outline" size={24} color="#EF4444" />
          <Text style={styles.statValue}>{stats.checkOutsToday}</Text>
          <Text style={styles.statLabel}>Check-outs Today</Text>
        </View>
      </ScrollView>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search bookings..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        {['all', 'today', 'week', 'month'].map((range) => (
          <TouchableOpacity
            key={range}
            style={[styles.filterChip, dateRange === range && styles.filterChipActive]}
            onPress={() => setDateRange(range)}
          >
            <Text
              style={[styles.filterChipText, dateRange === range && styles.filterChipTextActive]}
            >
              {range === 'all'
                ? 'All Dates'
                : range === 'today'
                ? 'Today'
                : range === 'week'
                ? 'This Week'
                : 'This Month'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {['all', 'pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'all'
                ? 'All'
                : tab
                    .split('-')
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bookings List */}
      <FlatList
        data={filteredBookings}
        renderItem={renderBookingCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.bookingsList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="calendar-outline" size={40} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>No bookings found</Text>
            <Text style={styles.emptySubtitle}>
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Get started by creating your first booking'}
            </Text>
            {!searchTerm && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/bookings/new' as any)}
              >
                <Text style={styles.emptyButtonText}>Create Booking</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
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
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  addButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statsContent: {
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: 140,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
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
  filtersContainer: {
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#DBEAFE',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#1E3A8A',
  },
  tabsContainer: {
    marginBottom: 8,
    paddingHorizontal: 16,
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
  guestName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  guestEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
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
  refundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  refundText: {
    fontSize: 12,
    color: '#92400E',
    marginLeft: 6,
    fontWeight: '600',
  },
  bookingDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  amountLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginTop: 2,
  },
  paymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  paymentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'capitalize',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
});