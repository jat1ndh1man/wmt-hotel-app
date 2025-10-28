import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { supabase } from '../../../lib/supabaseClient';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface RoomType {
  id: string;
  property_id: string;
  name: string;
  bed_type: string;
  base_rate: number;
  max_occupancy: number;
  total_rooms: number;
}

interface Property {
  id: string;
  name: string;
  city: string;
}

interface FormData {
  guestType: 'new' | 'existing';
  existingGuestId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  propertyId: string;
  roomTypeId: string;
  roomsBooked: number;
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  checkOutTime: string;
  adults: number;
  children: number;
  specialRequests: string;
  totalAmount: string;
  advanceAmount: string;
  paymentStatus: string;
  bookingStatus: string;
  bookingSource: string;
}

const TABS = [
  { id: 'guest', label: 'Guest', required: true },
  { id: 'booking', label: 'Booking', required: true },
  { id: 'payment', label: 'Payment', required: true },
  { id: 'additional', label: 'Additional', required: false },
  { id: 'review', label: 'Review', required: false },
];

export default function NewBookingScreen() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState('guest');
  const [completedTabs, setCompletedTabs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState(0);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [guestSearchQuery, setGuestSearchQuery] = useState('');

  // DatePicker states
  const [showCheckInPicker, setShowCheckInPicker] = useState(false);
  const [showCheckOutPicker, setShowCheckOutPicker] = useState(false);
  const [checkInDateObj, setCheckInDateObj] = useState<Date>(new Date());
  const [checkOutDateObj, setCheckOutDateObj] = useState<Date>(new Date(Date.now() + 86400000));

  const [formData, setFormData] = useState<FormData>({
    guestType: 'new',
    existingGuestId: '',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    propertyId: '',
    roomTypeId: '',
    roomsBooked: 1,
    checkInDate: '',
    checkOutDate: '',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    adults: 1,
    children: 0,
    specialRequests: '',
    totalAmount: '',
    advanceAmount: '',
    paymentStatus: 'pending',
    bookingStatus: 'confirmed',
    bookingSource: 'direct',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [guests, setGuests] = useState<Guest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [filteredRoomTypes, setFilteredRoomTypes] = useState<RoomType[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (formData.propertyId) {
      const filtered = roomTypes.filter((rt) => rt.property_id === formData.propertyId);
      setFilteredRoomTypes(filtered);
    } else {
      setFilteredRoomTypes([]);
    }
  }, [formData.propertyId, roomTypes]);

  useEffect(() => {
    if (formData.roomTypeId && formData.checkInDate && formData.checkOutDate) {
      checkRoomAvailability();
      calculatePrice();
    }
  }, [formData.roomTypeId, formData.checkInDate, formData.checkOutDate, formData.roomsBooked]);

  const loadInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: guestsData } = await supabase
        .from('guests')
        .select('*')
        .order('name');
      setGuests(guestsData || []);

      const { data: propertiesData } = await supabase
        .from('hotels')
        .select('id, name, city')
        .eq('owner_id', user.id)
        .order('name');
      setProperties(propertiesData || []);

      const { data: roomTypesData } = await supabase
        .from('room_types')
        .select('*')
        .eq('status', 'active')
        .in(
          'property_id',
          propertiesData?.map((p) => p.id) || []
        )
        .order('base_rate');
      setRoomTypes(roomTypesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load initial data',
      });
    }
  };

  const checkRoomAvailability = async () => {
    if (!formData.roomTypeId || !formData.checkInDate || !formData.checkOutDate) return;

    try {
      setCheckingAvailability(true);

      const roomType = roomTypes.find((rt) => rt.id === formData.roomTypeId);
      if (!roomType) return;

      const { data: overlappingBookings } = await supabase
        .from('bookings')
        .select('rooms_booked')
        .eq('room_type_id', formData.roomTypeId)
        .in('status', ['confirmed', 'checked-in'])
        .lt('check_in_date', formData.checkOutDate)
        .gt('check_out_date', formData.checkInDate);

      const totalBooked =
        overlappingBookings?.reduce((sum, b) => sum + (b.rooms_booked || 0), 0) || 0;
      const available = Math.max(0, roomType.total_rooms - totalBooked);
      setAvailableRooms(available);

      if (available === 0) {
        Toast.show({
          type: 'error',
          text1: 'No Availability',
          text2: 'No rooms available for selected dates',
        });
      }
    } catch (error) {
      console.error('Error checking availability:', error);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const calculatePrice = () => {
    if (!formData.checkInDate || !formData.checkOutDate || !formData.roomTypeId) return;

    const roomType = roomTypes.find((rt) => rt.id === formData.roomTypeId);
    if (!roomType) return;

    const checkIn = new Date(formData.checkInDate);
    const checkOut = new Date(formData.checkOutDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    if (nights > 0) {
      const baseAmount = roomType.base_rate * nights * formData.roomsBooked;
      const taxes = baseAmount * 0.18;
      const total = baseAmount + taxes;
      setFormData((prev) => ({ ...prev, totalAmount: total.toString() }));
    }
  };

  // DatePicker helper functions
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (dateString: string): string => {
    if (!dateString) return 'Select date';
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  const onCheckInDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowCheckInPicker(false);
    }
    if (selectedDate) {
      setCheckInDateObj(selectedDate);
      const formattedDate = formatDate(selectedDate);
      handleInputChange('checkInDate', formattedDate);
      if (formData.checkOutDate && new Date(formData.checkOutDate) <= selectedDate) {
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        setCheckOutDateObj(nextDay);
        handleInputChange('checkOutDate', formatDate(nextDay));
      }
    }
  };

  const onCheckOutDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowCheckOutPicker(false);
    }
    if (selectedDate) {
      setCheckOutDateObj(selectedDate);
      handleInputChange('checkOutDate', formatDate(selectedDate));
    }
  };

  const validateTab = (tabId: string): boolean => {
    const newErrors: { [key: string]: string } = {};

    switch (tabId) {
      case 'guest':
        if (!formData.guestName.trim()) newErrors.guestName = 'Guest name is required';
        if (!formData.guestEmail.trim()) newErrors.guestEmail = 'Email is required';
        if (!formData.guestPhone.trim()) newErrors.guestPhone = 'Phone is required';
        if (formData.guestEmail && !/\S+@\S+\.\S+/.test(formData.guestEmail)) {
          newErrors.guestEmail = 'Invalid email format';
        }
        if (formData.guestPhone && !/^(\+91|91)?[6-9]\d{9}$/.test(formData.guestPhone)) {
          newErrors.guestPhone = 'Invalid phone number';
        }
        break;

      case 'booking':
        if (!formData.propertyId) newErrors.propertyId = 'Property is required';
        if (!formData.roomTypeId) newErrors.roomTypeId = 'Room type is required';
        if (!formData.checkInDate) newErrors.checkInDate = 'Check-in date is required';
        if (!formData.checkOutDate) newErrors.checkOutDate = 'Check-out date is required';
        if (
          formData.checkInDate &&
          formData.checkOutDate &&
          new Date(formData.checkInDate) >= new Date(formData.checkOutDate)
        ) {
          newErrors.checkOutDate = 'Check-out must be after check-in';
        }
        if (formData.roomsBooked < 1) newErrors.roomsBooked = 'At least 1 room required';
        if (formData.roomsBooked > availableRooms) {
          newErrors.roomsBooked = `Only ${availableRooms} rooms available`;
        }
        if (formData.adults < 1) newErrors.adults = 'At least 1 adult required';
        break;

      case 'payment':
        if (!formData.totalAmount || parseFloat(formData.totalAmount) <= 0) {
          newErrors.totalAmount = 'Total amount is required';
        }
        if (!formData.paymentStatus) newErrors.paymentStatus = 'Payment status is required';
        if (!formData.bookingStatus) newErrors.bookingStatus = 'Booking status is required';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const canProceedToTab = (tabId: string): boolean => {
    const currentIndex = TABS.findIndex((tab) => tab.id === currentTab);
    const targetIndex = TABS.findIndex((tab) => tab.id === tabId);

    if (targetIndex <= currentIndex) return true;

    for (let i = 0; i < targetIndex; i++) {
      const tab = TABS[i];
      if (tab.required && !completedTabs.includes(tab.id)) {
        return false;
      }
    }

    return true;
  };

  const markTabCompleted = (tabId: string) => {
    if (!completedTabs.includes(tabId)) {
      setCompletedTabs((prev) => [...prev, tabId]);
    }
  };

  const proceedToNextTab = () => {
    if (validateTab(currentTab)) {
      markTabCompleted(currentTab);
      const currentIndex = TABS.findIndex((tab) => tab.id === currentTab);
      if (currentIndex < TABS.length - 1) {
        setCurrentTab(TABS[currentIndex + 1].id);
      }
    } else {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fix the errors before proceeding',
      });
    }
  };

  const goToPreviousTab = () => {
    const currentIndex = TABS.findIndex((tab) => tab.id === currentTab);
    if (currentIndex > 0) {
      setCurrentTab(TABS[currentIndex - 1].id);
    }
  };

  const getProgressPercentage = () => {
    const requiredTabs = TABS.filter((tab) => tab.required);
    const completedRequiredTabs = requiredTabs.filter((tab) => completedTabs.includes(tab.id));
    return (completedRequiredTabs.length / requiredTabs.length) * 100;
  };

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }

    if (field === 'roomTypeId') {
      const roomType = roomTypes.find((rt) => rt.id === value);
      setSelectedRoomType(roomType || null);
    }
  };

  const handleGuestSelection = (guestId: string) => {
    const guest = guests.find((g) => g.id === guestId);
    if (guest) {
      setFormData((prev) => ({
        ...prev,
        existingGuestId: guestId,
        guestName: guest.name,
        guestEmail: guest.email,
        guestPhone: guest.phone || '',
      }));
      setGuestSearchQuery('');
    }
  };

  const filteredGuests = guests.filter(
    (guest) =>
      guest.name.toLowerCase().includes(guestSearchQuery.toLowerCase()) ||
      guest.email.toLowerCase().includes(guestSearchQuery.toLowerCase()) ||
      guest.phone?.includes(guestSearchQuery)
  );

  const handleCreateBooking = async () => {
    const requiredTabs = ['guest', 'booking', 'payment'];
    let allValid = true;

    for (const tabId of requiredTabs) {
      if (!validateTab(tabId)) {
        allValid = false;
        setCurrentTab(tabId);
        break;
      }
    }

    if (!allValid) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fix the errors before submitting',
      });
      return;
    }

    try {
      setLoading(true);

      let guestId = formData.existingGuestId;

      if (formData.guestType === 'new' && !guestId) {
        const { data: newGuest, error: guestError } = await supabase
          .from('guests')
          .insert([
            {
              name: formData.guestName,
              email: formData.guestEmail,
              phone: formData.guestPhone,
            },
          ])
          .select()
          .single();

        if (guestError) throw guestError;
        guestId = newGuest.id;
      }

      const bookingReference = `BK${Date.now().toString().slice(-6)}${Math.random()
        .toString(36)
        .substring(2, 5)
        .toUpperCase()}`;

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert([
          {
            room_type_id: formData.roomTypeId,
            guest_id: guestId,
            guest_name: formData.guestName,
            guest_email: formData.guestEmail,
            guest_phone: formData.guestPhone,
            check_in_date: formData.checkInDate,
            check_out_date: formData.checkOutDate,
            check_in_time: formData.checkInTime,
            check_out_time: formData.checkOutTime,
            rooms_booked: formData.roomsBooked,
            adults: formData.adults,
            children: formData.children,
            total_amount: parseFloat(formData.totalAmount),
            advance_amount: formData.advanceAmount ? parseFloat(formData.advanceAmount) : null,
            payment_status: formData.paymentStatus,
            status: formData.bookingStatus,
            booking_reference: bookingReference,
            booking_source: formData.bookingSource,
            special_requests: formData.specialRequests || null,
          },
        ])
        .select()
        .single();

      if (bookingError) throw bookingError;

      await supabase.from('booking_status').insert([
        {
          booking_id: booking.id,
          status: formData.bookingStatus,
        },
      ]);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Booking created! Reference: ${bookingReference}`,
      });

      router.back();
    } catch (error: any) {
      console.error('Error creating booking:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to create booking',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 'guest':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Guest Information</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Guest Type</Text>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    formData.guestType === 'new' && styles.segmentButtonActive,
                  ]}
                  onPress={() => handleInputChange('guestType', 'new')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      formData.guestType === 'new' && styles.segmentTextActive,
                    ]}
                  >
                    New Guest
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    formData.guestType === 'existing' && styles.segmentButtonActive,
                  ]}
                  onPress={() => handleInputChange('guestType', 'existing')}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      formData.guestType === 'existing' && styles.segmentTextActive,
                    ]}
                  >
                    Existing Guest
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {formData.guestType === 'existing' && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Search & Select Guest</Text>
                
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={18} color="#6B7280" />
                  <TextInput
                    style={styles.searchInput}
                    value={guestSearchQuery}
                    onChangeText={setGuestSearchQuery}
                    placeholder="Search by name, email or phone"
                    placeholderTextColor="#9CA3AF"
                  />
                  {guestSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setGuestSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Guest List */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.guestListContainer}
                >
                  {filteredGuests.length > 0 ? (
                    filteredGuests.map((guest) => (
                      <TouchableOpacity
                        key={guest.id}
                        style={[
                          styles.guestCard,
                          formData.existingGuestId === guest.id && styles.guestCardActive,
                        ]}
                        onPress={() => handleGuestSelection(guest.id)}
                      >
                        <Text style={styles.guestCardName}>{guest.name}</Text>
                        <Text style={styles.guestCardEmail} numberOfLines={1}>{guest.email}</Text>
                        {guest.phone && (
                          <Text style={styles.guestCardPhone}>{guest.phone}</Text>
                        )}
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.noResultsContainer}>
                      <Text style={styles.noResultsText}>No guests found</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={[styles.input, errors.guestName && styles.inputError]}
                value={formData.guestName}
                onChangeText={(text) => handleInputChange('guestName', text)}
                placeholder="Enter guest name"
                placeholderTextColor="#9CA3AF"
              />
              {errors.guestName && <Text style={styles.errorText}>{errors.guestName}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={[styles.input, errors.guestEmail && styles.inputError]}
                value={formData.guestEmail}
                onChangeText={(text) => handleInputChange('guestEmail', text)}
                placeholder="guest@example.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.guestEmail && <Text style={styles.errorText}>{errors.guestEmail}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={[styles.input, errors.guestPhone && styles.inputError]}
                value={formData.guestPhone}
                onChangeText={(text) => handleInputChange('guestPhone', text)}
                placeholder="+91 9876543210"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
              {errors.guestPhone && <Text style={styles.errorText}>{errors.guestPhone}</Text>}
            </View>
          </View>
        );

      case 'booking':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Booking Details</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Property *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {properties.map((property) => (
                  <TouchableOpacity
                    key={property.id}
                    style={[
                      styles.propertyCard,
                      formData.propertyId === property.id && styles.propertyCardActive,
                    ]}
                    onPress={() => handleInputChange('propertyId', property.id)}
                  >
                    <Text style={styles.propertyCardName}>{property.name}</Text>
                    <Text style={styles.propertyCardCity}>{property.city}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {errors.propertyId && <Text style={styles.errorText}>{errors.propertyId}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Room Type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {filteredRoomTypes.map((roomType) => (
                  <TouchableOpacity
                    key={roomType.id}
                    style={[
                      styles.roomTypeCard,
                      formData.roomTypeId === roomType.id && styles.roomTypeCardActive,
                    ]}
                    onPress={() => handleInputChange('roomTypeId', roomType.id)}
                  >
                    <Text style={styles.roomTypeCardName}>{roomType.name}</Text>
                    <Text style={styles.roomTypeCardPrice}>
                      {formatCurrency(roomType.base_rate)}/night
                    </Text>
                    <Text style={styles.roomTypeCardCapacity}>
                      Max {roomType.max_occupancy} guests
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {errors.roomTypeId && <Text style={styles.errorText}>{errors.roomTypeId}</Text>}
            </View>

            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Check-in Date *</Text>
                <TouchableOpacity
                  style={[styles.datePickerButton, errors.checkInDate && styles.inputError]}
                  onPress={() => setShowCheckInPicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#1E3A8A" />
                  <Text style={styles.datePickerText}>
                    {formatDisplayDate(formData.checkInDate)}
                  </Text>
                </TouchableOpacity>
                {errors.checkInDate && <Text style={styles.errorText}>{errors.checkInDate}</Text>}
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Check-out Date *</Text>
                <TouchableOpacity
                  style={[styles.datePickerButton, errors.checkOutDate && styles.inputError]}
                  onPress={() => setShowCheckOutPicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#1E3A8A" />
                  <Text style={styles.datePickerText}>
                    {formatDisplayDate(formData.checkOutDate)}
                  </Text>
                </TouchableOpacity>
                {errors.checkOutDate && (
                  <Text style={styles.errorText}>{errors.checkOutDate}</Text>
                )}
              </View>
            </View>

            {showCheckInPicker && (
              <DateTimePicker
                value={checkInDateObj}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onCheckInDateChange}
                minimumDate={new Date()}
                onTouchCancel={() => setShowCheckInPicker(false)}
              />
            )}

            {showCheckOutPicker && (
              <DateTimePicker
                value={checkOutDateObj}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onCheckOutDateChange}
                minimumDate={formData.checkInDate ? new Date(new Date(formData.checkInDate).getTime() + 86400000) : new Date()}
                onTouchCancel={() => setShowCheckOutPicker(false)}
              />
            )}

            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Check-in Time *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.checkInTime}
                  onChangeText={(text) => handleInputChange('checkInTime', text)}
                  placeholder="14:00"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Check-out Time *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.checkOutTime}
                  onChangeText={(text) => handleInputChange('checkOutTime', text)}
                  placeholder="11:00"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {checkingAvailability && (
              <View style={styles.availabilityCheck}>
                <ActivityIndicator size="small" color="#1E3A8A" />
                <Text style={styles.availabilityText}>Checking availability...</Text>
              </View>
            )}

            {!checkingAvailability && availableRooms > 0 && formData.roomTypeId && (
              <View style={styles.availabilityInfo}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.availabilityText}>
                  {availableRooms} room{availableRooms !== 1 ? 's' : ''} available
                </Text>
              </View>
            )}

            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Rooms to Book *</Text>
                <TextInput
                  style={[styles.input, errors.roomsBooked && styles.inputError]}
                  value={formData.roomsBooked.toString()}
                  onChangeText={(text) =>
                    handleInputChange('roomsBooked', parseInt(text) || 1)
                  }
                  placeholder="1"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
                {errors.roomsBooked && <Text style={styles.errorText}>{errors.roomsBooked}</Text>}
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Adults *</Text>
                <TextInput
                  style={[styles.input, errors.adults && styles.inputError]}
                  value={formData.adults.toString()}
                  onChangeText={(text) => handleInputChange('adults', parseInt(text) || 1)}
                  placeholder="1"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
                {errors.adults && <Text style={styles.errorText}>{errors.adults}</Text>}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Children</Text>
              <TextInput
                style={styles.input}
                value={formData.children.toString()}
                onChangeText={(text) => handleInputChange('children', parseInt(text) || 0)}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>
          </View>
        );

      case 'payment':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Payment Details</Text>

            {formData.totalAmount && parseFloat(formData.totalAmount) > 0 && (
              <View style={styles.priceBreakdown}>
                <Text style={styles.breakdownTitle}>Price Calculation</Text>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Base Amount</Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrency(parseFloat(formData.totalAmount) / 1.18)}
                  </Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>GST (18%)</Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrency(
                      parseFloat(formData.totalAmount) - parseFloat(formData.totalAmount) / 1.18
                    )}
                  </Text>
                </View>
                <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                  <Text style={styles.breakdownTotalLabel}>Total Amount</Text>
                  <Text style={styles.breakdownTotalValue}>
                    {formatCurrency(parseFloat(formData.totalAmount))}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Total Amount (₹) *</Text>
              <TextInput
                style={[styles.input, errors.totalAmount && styles.inputError]}
                value={formData.totalAmount}
                onChangeText={(text) => handleInputChange('totalAmount', text)}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                editable={false}
              />
              {errors.totalAmount && <Text style={styles.errorText}>{errors.totalAmount}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Advance Amount (₹)</Text>
              <TextInput
                style={styles.input}
                value={formData.advanceAmount}
                onChangeText={(text) => handleInputChange('advanceAmount', text)}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Payment Status *</Text>
              <View style={styles.optionsRow}>
                {['pending', 'paid', 'partial', 'pay-at-hotel'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.optionButton,
                      formData.paymentStatus === status && styles.optionButtonActive,
                    ]}
                    onPress={() => handleInputChange('paymentStatus', status)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        formData.paymentStatus === status && styles.optionTextActive,
                      ]}
                    >
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Booking Status *</Text>
              <View style={styles.optionsRow}>
                {['pending', 'confirmed'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.optionButton,
                      formData.bookingStatus === status && styles.optionButtonActive,
                    ]}
                    onPress={() => handleInputChange('bookingStatus', status)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        formData.bookingStatus === status && styles.optionTextActive,
                      ]}
                    >
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Booking Source *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['direct', 'phone', 'walk-in', 'website', 'booking.com', 'oyo'].map((source) => (
                  <TouchableOpacity
                    key={source}
                    style={[
                      styles.sourceButton,
                      formData.bookingSource === source && styles.sourceButtonActive,
                    ]}
                    onPress={() => handleInputChange('bookingSource', source)}
                  >
                    <Text
                      style={[
                        styles.sourceText,
                        formData.bookingSource === source && styles.sourceTextActive,
                      ]}
                    >
                      {source}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        );

      case 'additional':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Additional Information</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Special Requests</Text>
              <TextInput
                style={styles.textArea}
                value={formData.specialRequests}
                onChangeText={(text) => handleInputChange('specialRequests', text)}
                placeholder="Any special requests..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
              />
            </View>
          </View>
        );

      case 'review':
        return (
          <ScrollView style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Review Booking</Text>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Guest Information</Text>
              <Text style={styles.reviewText}>Name: {formData.guestName}</Text>
              <Text style={styles.reviewText}>Email: {formData.guestEmail}</Text>
              <Text style={styles.reviewText}>Phone: {formData.guestPhone}</Text>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Booking Details</Text>
              <Text style={styles.reviewText}>
                Property: {properties.find((p) => p.id === formData.propertyId)?.name}
              </Text>
              <Text style={styles.reviewText}>
                Room Type: {roomTypes.find((r) => r.id === formData.roomTypeId)?.name}
              </Text>
              <Text style={styles.reviewText}>
                Check-in: {formData.checkInDate} at {formData.checkInTime}
              </Text>
              <Text style={styles.reviewText}>
                Check-out: {formData.checkOutDate} at {formData.checkOutTime}
              </Text>
              <Text style={styles.reviewText}>Rooms: {formData.roomsBooked}</Text>
              <Text style={styles.reviewText}>
                Guests: {formData.adults} adults, {formData.children} children
              </Text>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Payment</Text>
              <Text style={styles.reviewText}>
                Total Amount: {formatCurrency(parseFloat(formData.totalAmount))}
              </Text>
              {formData.advanceAmount && (
                <Text style={styles.reviewText}>
                  Advance: {formatCurrency(parseFloat(formData.advanceAmount))}
                </Text>
              )}
              <Text style={styles.reviewText}>Payment Status: {formData.paymentStatus}</Text>
              <Text style={styles.reviewText}>Booking Status: {formData.bookingStatus}</Text>
            </View>

            {formData.specialRequests && (
              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionTitle}>Special Requests</Text>
                <Text style={styles.reviewText}>{formData.specialRequests}</Text>
              </View>
            )}
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Booking</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Compact Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${getProgressPercentage()}%` }]} />
        </View>
      </View>

      {/* Compact Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((tab, index) => {
          const isActive = currentTab === tab.id;
          const isCompleted = completedTabs.includes(tab.id);
          const canAccess = canProceedToTab(tab.id);

          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, !canAccess && styles.tabItemDisabled]}
              onPress={() => {
                if (canAccess) {
                  setCurrentTab(tab.id);
                } else {
                  Toast.show({
                    type: 'info',
                    text1: 'Complete Previous Steps',
                    text2: 'Please complete the previous required steps first',
                  });
                }
              }}
              disabled={!canAccess}
            >
              <View
                style={[
                  styles.tabNumber,
                  isActive && styles.tabNumberActive,
                  isCompleted && styles.tabNumberCompleted,
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : (
                  <Text style={[styles.tabNumberText, isActive && styles.tabNumberTextActive]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderTabContent()}
      </ScrollView>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.footerButton, currentTab === 'guest' && styles.footerButtonDisabled]}
          onPress={goToPreviousTab}
          disabled={currentTab === 'guest'}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={currentTab === 'guest' ? '#9CA3AF' : '#1E3A8A'}
          />
          <Text
            style={[
              styles.footerButtonText,
              currentTab === 'guest' && styles.footerButtonTextDisabled,
            ]}
          >
            Previous
          </Text>
        </TouchableOpacity>

        {currentTab !== 'review' ? (
          <TouchableOpacity style={styles.footerButtonPrimary} onPress={proceedToNextTab}>
            <LinearGradient
              colors={['#1E3A8A', '#1E40AF']}
              style={styles.footerButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.footerButtonPrimaryText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.footerButtonPrimary}
            onPress={handleCreateBooking}
            disabled={loading}
          >
            <LinearGradient
              colors={['#1E3A8A', '#1E40AF']}
              style={styles.footerButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.footerButtonPrimaryText}>Create Booking</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E3A8A',
    borderRadius: 2,
  },
  tabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    maxHeight: 50,
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    paddingVertical: 4,
  },
  tabItemDisabled: {
    opacity: 0.5,
  },
  tabNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  tabNumberActive: {
    backgroundColor: '#1E3A8A',
  },
  tabNumberCompleted: {
    backgroundColor: '#10B981',
  },
  tabNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabNumberTextActive: {
    color: '#fff',
  },
  tabLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#1E3A8A',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
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
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  segmentButtonActive: {
    backgroundColor: '#1E3A8A',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  segmentTextActive: {
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    marginLeft: 8,
    marginRight: 8,
  },
  guestListContainer: {
    maxHeight: 100,
  },
  guestCard: {
    width: 180,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    marginRight: 10,
  },
  guestCardActive: {
    borderColor: '#1E3A8A',
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
  },
  guestCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  guestCardEmail: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  guestCardPhone: {
    fontSize: 11,
    color: '#6B7280',
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  propertyCard: {
    width: 140,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    marginRight: 10,
  },
  propertyCardActive: {
    borderColor: '#1E3A8A',
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
  },
  propertyCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  propertyCardCity: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  roomTypeCard: {
    width: 130,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    marginRight: 10,
  },
  roomTypeCardActive: {
    borderColor: '#1E3A8A',
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
  },
  roomTypeCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  roomTypeCardPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 2,
  },
  roomTypeCardCapacity: {
    fontSize: 10,
    color: '#6B7280',
  },
  availabilityCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 12,
  },
  availabilityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    marginBottom: 12,
  },
  availabilityText: {
    fontSize: 13,
    color: '#065F46',
    marginLeft: 8,
    fontWeight: '600',
  },
  priceBreakdown: {
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  breakdownTotal: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  breakdownTotalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
  },
  breakdownTotalValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  optionButtonActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'capitalize',
  },
  optionTextActive: {
    color: '#fff',
  },
  sourceButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  sourceButtonActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  sourceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'capitalize',
  },
  sourceTextActive: {
    color: '#fff',
  },
  reviewSection: {
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reviewSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 10,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    gap: 6,
  },
  footerButtonDisabled: {
    opacity: 0.5,
  },
  footerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  footerButtonTextDisabled: {
    color: '#9CA3AF',
  },
  footerButtonPrimary: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  footerButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    gap: 6,
  },
  footerButtonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  datePickerText: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
});