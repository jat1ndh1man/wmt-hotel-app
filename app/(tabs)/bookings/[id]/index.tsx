import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { supabase } from '../../../../lib/supabaseClient';

interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  emergency_contact?: string;
  dietary_requirements?: string;
  accessibility_needs?: string;
}

interface RoomType {
  id: string;
  name: string;
  base_rate: number;
  capacity: number;
}

interface Property {
  id: string;
  name: string;
  city: string;
  state: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface RefundRequest {
  id: string;
  booking_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'failed';
  amount_requested_to_refund: number;
  reason?: string;
  refund_type?: string;
  tier?: string;
}

interface BookingDrink {
  id: string;
  guest_name: string;
  drink_name: string;
  drink_type: string;
  special_notes?: string;
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
  payment_status: 'pending' | 'partial' | 'paid' | 'pay-at-hotel';
  total_amount: number;
  advance_amount?: number;
  special_requests?: string;
  booking_source: string;
  created_at: string;
  guest?: Guest;
  room_type?: RoomType;
  property?: Property;
  refund_request?: RefundRequest;
  booking_drinks?: BookingDrink[];
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBookingDetails();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookingDetails();
    setRefreshing(false);
  };

  const loadBookingDetails = async () => {
    try {
      setLoading(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Fetch booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();

      if (bookingError) throw bookingError;

      // Get room type
      const { data: roomTypeData } = await supabase
        .from('room_types')
        .select('*')
        .eq('id', bookingData.room_type_id)
        .single();

      // Get property
      const { data: propertyData } = await supabase
        .from('hotels')
        .select('*')
        .eq('id', roomTypeData?.property_id)
        .single();

      // Get guest
      const { data: guestData } = await supabase
        .from('guests')
        .select('*')
        .eq('id', bookingData.guest_id)
        .single();

      // Get booking status
      const { data: bookingStatus } = await supabase
        .from('booking_status')
        .select('*')
        .eq('booking_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get refund request
      const { data: refundRequest } = await supabase
        .from('refund_requests')
        .select('*')
        .eq('booking_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get booking drinks
      const { data: drinksData } = await supabase
        .from('booking_drinks')
        .select('*')
        .eq('booking_id', id);

      const currentStatus = bookingStatus?.status || bookingData.status;

      setBooking({
        ...bookingData,
        status: currentStatus,
        guest: guestData,
        room_type: roomTypeData,
        property: propertyData,
        refund_request: refundRequest,
        booking_drinks: drinksData || [],
      });
    } catch (error: any) {
      console.error('Error loading booking:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load booking details',
      });
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (newStatus: string) => {
    try {
      setUpdating(true);

      await supabase.from('booking_status').upsert(
        {
          booking_id: booking!.id,
          status: newStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'booking_id' }
      );

      await supabase
        .from('bookings')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', booking!.id);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Booking status updated to ${newStatus}`,
      });

      loadBookingDetails();
    } catch (error) {
      console.error('Error updating booking:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update booking status',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelBooking = () => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => updateBookingStatus('cancelled'),
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateNights = () => {
    if (!booking) return 0;
    const checkIn = new Date(booking.check_in_date);
    const checkOut = new Date(booking.check_out_date);
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
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

  const getRefundStatusStyle = (status: string) => {
    const statusMap: { [key: string]: any } = {
      approved: { backgroundColor: '#D1FAE5', color: '#065F46' },
      pending: { backgroundColor: '#FEF3C7', color: '#92400E' },
      rejected: { backgroundColor: '#FEE2E2', color: '#991B1B' },
      processed: { backgroundColor: '#DBEAFE', color: '#1E3A8A' },
      failed: { backgroundColor: '#FEE2E2', color: '#991B1B' },
    };
    return statusMap[status] || { backgroundColor: '#F3F4F6', color: '#1F2937' };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Loading booking details...</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Booking not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <Text style={styles.headerSubtitle}>ID: {booking.id.slice(0, 8)}...</Text>
        </View>
        <View style={[styles.statusBadge, getStatusStyle(booking.status)]}>
       <Text
  style={[
    styles.statusText,
    { color: getStatusStyle(booking?.status)?.color || 'black' },
  ]}
>
  {(booking?.status || 'unknown').replace('-', ' ')}
</Text>

        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Refund Request Alert */}
        {booking.refund_request && (
          <View style={styles.refundCard}>
            <View style={styles.refundHeader}>
              <Ionicons name="alert-circle" size={24} color="#F59E0B" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.refundTitle}>Refund Request</Text>
                <Text style={styles.refundAmount}>
                  {formatCurrency(booking.refund_request.amount_requested_to_refund)}
                </Text>
              </View>
              <View style={[styles.refundBadge, getRefundStatusStyle(booking.refund_request.status)]}>
                <Text
                  style={[
                    styles.refundBadgeText,
                    { color: getRefundStatusStyle(booking.refund_request.status).color },
                  ]}
                >
                  {booking.refund_request.status}
                </Text>
              </View>
            </View>
            {booking.refund_request.reason && (
              <View style={styles.refundReasonBox}>
                <Text style={styles.refundReasonLabel}>Reason:</Text>
                <Text style={styles.refundReasonText}>{booking.refund_request.reason}</Text>
              </View>
            )}
          </View>
        )}

        {/* Property Information */}
        {booking.property && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="business" size={20} color="#1E3A8A" />
              <Text style={styles.cardTitle}>Property Information</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.propertyName}>{booking.property.name}</Text>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color="#6B7280" />
                <Text style={styles.infoText}>
                  {booking.property.city}, {booking.property.state}
                </Text>
              </View>
              {booking.property.phone && (
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={16} color="#6B7280" />
                  <Text style={styles.infoText}>{booking.property.phone}</Text>
                </View>
              )}
              {booking.property.email && (
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={16} color="#6B7280" />
                  <Text style={styles.infoText}>{booking.property.email}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Guest Information */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person" size={20} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Guest Information</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.guestName}>{booking.guest?.name || 'Unknown Guest'}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={16} color="#6B7280" />
              <Text style={styles.infoText}>{booking.guest?.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={16} color="#6B7280" />
              <Text style={styles.infoText}>{booking.guest?.phone}</Text>
            </View>
            {booking.guest?.emergency_contact && (
              <View style={styles.infoRow}>
                <Ionicons name="alert-circle-outline" size={16} color="#6B7280" />
                <Text style={styles.infoText}>Emergency: {booking.guest.emergency_contact}</Text>
              </View>
            )}
            {booking.guest?.dietary_requirements && (
              <View style={styles.specialNote}>
                <Text style={styles.specialNoteLabel}>Dietary Requirements</Text>
                <Text style={styles.specialNoteText}>{booking.guest.dietary_requirements}</Text>
              </View>
            )}
            {booking.guest?.accessibility_needs && (
              <View style={styles.specialNote}>
                <Text style={styles.specialNoteLabel}>Accessibility Needs</Text>
                <Text style={styles.specialNoteText}>{booking.guest.accessibility_needs}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Booking Information */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar" size={20} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Booking Information</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.detailGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Room Type</Text>
                <Text style={styles.detailValue}>{booking.room_type?.name}</Text>
                <Text style={styles.detailSubtext}>Capacity: {booking.room_type?.capacity} guests</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Rooms</Text>
                <Text style={styles.detailValue}>{booking.rooms_booked}</Text>
                <Text style={styles.detailSubtext}>{calculateNights()} night(s)</Text>
              </View>
            </View>

            <View style={styles.dateSection}>
              <View style={styles.dateBox}>
                <Text style={styles.dateLabel}>Check-in</Text>
                <Text style={styles.dateText}>{formatDate(booking.check_in_date)}</Text>
                <Text style={styles.timeText}>{formatTime(booking.check_in_time)}</Text>
              </View>
              <Ionicons name="arrow-forward" size={24} color="#9CA3AF" />
              <View style={styles.dateBox}>
                <Text style={styles.dateLabel}>Check-out</Text>
                <Text style={styles.dateText}>{formatDate(booking.check_out_date)}</Text>
                <Text style={styles.timeText}>{formatTime(booking.check_out_time)}</Text>
              </View>
            </View>

            <View style={styles.detailGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Adults</Text>
                <Text style={styles.detailValue}>{booking.adults}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Children</Text>
                <Text style={styles.detailValue}>{booking.children}</Text>
              </View>
            </View>

            {booking.special_requests && (
              <View style={styles.specialNote}>
                <Text style={styles.specialNoteLabel}>Special Requests</Text>
                <Text style={styles.specialNoteText}>{booking.special_requests}</Text>
              </View>
            )}

            <View style={styles.detailGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Booking Source</Text>
                <Text style={[styles.detailValue, { textTransform: 'capitalize' }]}>
                  {booking.booking_source}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Created</Text>
                <Text style={styles.detailValue}>
                  {new Date(booking.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Welcome Drinks */}
        {booking.booking_drinks && booking.booking_drinks.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="cafe" size={20} color="#1E3A8A" />
              <Text style={styles.cardTitle}>Welcome Drinks</Text>
            </View>
            <View style={styles.cardContent}>
              {booking.booking_drinks.map((drink) => (
                <View key={drink.id} style={styles.drinkItem}>
                  <Text style={styles.drinkName}>{drink.drink_name}</Text>
                  <View style={styles.drinkDetails}>
                    <Text style={styles.drinkGuest}>For: {drink.guest_name}</Text>
                    <View style={styles.drinkTypeBadge}>
                      <Text style={styles.drinkTypeText}>{drink.drink_type}</Text>
                    </View>
                  </View>
                  {drink.special_notes && (
                    <Text style={styles.drinkNotes}>{drink.special_notes}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Payment Summary */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="wallet" size={20} color="#1E3A8A" />
            <Text style={styles.cardTitle}>Payment Summary</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>
                Room Rate ({calculateNights()} night{calculateNights() !== 1 ? 's' : ''})
              </Text>
              <Text style={styles.paymentValue}>{formatCurrency(booking.total_amount / 1.18)}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>GST (18%)</Text>
              <Text style={styles.paymentValue}>
                {formatCurrency(booking.total_amount - booking.total_amount / 1.18)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.paymentRow}>
              <Text style={styles.paymentTotal}>Total Amount</Text>
              <Text style={styles.paymentTotal}>{formatCurrency(booking.total_amount)}</Text>
            </View>
            {booking.advance_amount && booking.advance_amount > 0 && (
              <>
                <View style={styles.paymentRow}>
                  <Text style={[styles.paymentLabel, { color: '#10B981' }]}>Advance Paid</Text>
                  <Text style={[styles.paymentValue, { color: '#10B981' }]}>
                    -{formatCurrency(booking.advance_amount)}
                  </Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentTotal}>Balance Due</Text>
                  <Text style={styles.paymentTotal}>
                    {formatCurrency(booking.total_amount - booking.advance_amount)}
                  </Text>
                </View>
              </>
            )}
            <View style={styles.paymentStatusRow}>
              <Text style={styles.paymentLabel}>Payment Status</Text>
              <View
                style={[
                  styles.paymentStatusBadge,
                  {
                    backgroundColor:
                      booking.payment_status === 'paid' ? '#D1FAE5' : '#FEF3C7',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.paymentStatusText,
                    {
                      color: booking.payment_status === 'paid' ? '#065F46' : '#92400E',
                    },
                  ]}
                >
                  {booking.payment_status}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        {booking.status !== 'cancelled' && booking.status !== 'checked-out' && (
          <View style={styles.actionsCard}>
            {booking.status === 'pending' && (
              <>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => updateBookingStatus('confirmed')}
                  disabled={updating}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.actionButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.actionButtonText}>Confirm Booking</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={handleCancelBooking}
                  disabled={updating}
                >
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                  <Text style={styles.rejectButtonText}>Reject Booking</Text>
                </TouchableOpacity>
              </>
            )}

            {booking.status === 'confirmed' && (
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => updateBookingStatus('checked-in')}
                disabled={updating}
              >
                <LinearGradient
                  colors={['#1E3A8A', '#1E40AF']}
                  style={styles.actionButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="log-in" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Check In Guest</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {booking.status === 'checked-in' && (
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => updateBookingStatus('checked-out')}
                disabled={updating}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.actionButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="log-out" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Check Out Guest</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {booking.status !== 'pending' && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelBooking}
                disabled={updating}
              >
                <Ionicons name="trash" size={20} color="#EF4444" />
                <Text style={styles.cancelButtonText}>Cancel Booking</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
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
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
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
  scrollView: {
    flex: 1,
  },
  refundCard: {
    backgroundColor: '#FEF3C7',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  refundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  refundTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  refundAmount: {
    fontSize: 14,
    color: '#92400E',
    marginTop: 2,
  },
  refundBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  refundBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  refundReasonBox: {
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
  },
  refundReasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  refundReasonText: {
    fontSize: 13,
    color: '#78350F',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  cardContent: {
    padding: 16,
  },
  propertyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  guestName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  specialNote: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  specialNoteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  specialNoteText: {
    fontSize: 14,
    color: '#111827',
  },
  detailGrid: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 16,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  detailSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  dateBox: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  timeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  drinkItem: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  drinkName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  drinkDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  drinkGuest: {
    fontSize: 14,
    color: '#6B7280',
  },
  drinkTypeBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  drinkTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E3A8A',
    textTransform: 'capitalize',
  },
  drinkNotes: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  paymentValue: {
    fontSize: 14,
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  paymentTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  paymentStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  paymentStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  paymentStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  actionsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  confirmButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 8,
  },
  rejectButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  cancelButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
});