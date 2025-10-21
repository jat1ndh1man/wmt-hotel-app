import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { propertyAPI, storageAPI } from '../../../lib/property';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

const TABS = [
  { id: 'basic', label: 'Basic Info', required: true },
  { id: 'location', label: 'Location', required: true },
  { id: 'contact', label: 'Contact', required: true },
  { id: 'images', label: 'Images', required: true },
  { id: 'amenities', label: 'Amenities', required: false },
  { id: 'policies', label: 'Policies', required: true },
];

const amenitiesList = [
  'WiFi', 'Swimming Pool', 'Parking', 'Restaurant', 'Room Service',
  'Gym/Fitness Center', 'Spa', 'Business Center', 'Conference Rooms',
  'Airport Shuttle', 'Pet Friendly', 'Laundry Service', '24/7 Front Desk',
  'Air Conditioning', 'Bar/Lounge', 'Beach Access',
];

const propertyTypes = ['Hotel', 'Resort', 'Villa', 'Apartment', 'Cottage', 'Homestay'];

interface FormData {
  name: string;
  property_type: string;
  description: string;
  short_description: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  area: string;
  landmark: string;
  phone: string;
  email: string;
  website: string;
  amenities: string[];
  check_in_time: string;
  check_out_time: string;
  house_rules: string;
  security_deposit: string;
  cancellation_policy: string;
  images: string[];
  price: string;
  star_category: string;
}

export default function AddPropertyScreen() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState('basic');
  const [completedTabs, setCompletedTabs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    property_type: '',
    description: '',
    short_description: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    area: '',
    landmark: '',
    phone: '',
    email: '',
    website: '',
    amenities: [],
    check_in_time: '14:00',
    check_out_time: '11:00',
    house_rules: '',
    security_deposit: '',
    cancellation_policy: 'flexible',
    images: [],
    price: '',
    star_category: '',
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateTab = (tabId: string): boolean => {
    const newErrors: { [key: string]: string } = {};

    switch (tabId) {
      case 'basic':
        if (!formData.name.trim()) newErrors.name = 'Property name is required';
        if (!formData.property_type) newErrors.property_type = 'Property type is required';
        if (!formData.short_description.trim())
          newErrors.short_description = 'Short description is required';
        if (!formData.price.trim()) newErrors.price = 'Base price is required';
        if (formData.price && (isNaN(Number(formData.price)) || Number(formData.price) <= 0)) {
          newErrors.price = 'Please enter a valid price';
        }
        break;

      case 'location':
        if (!formData.address.trim()) newErrors.address = 'Address is required';
        if (!formData.city.trim()) newErrors.city = 'City is required';
        if (!formData.state.trim()) newErrors.state = 'State is required';
        if (!formData.pincode.trim()) newErrors.pincode = 'Pincode is required';
        if (formData.pincode && !/^\d{6}$/.test(formData.pincode)) {
          newErrors.pincode = 'Please enter a valid 6-digit pincode';
        }
        break;

      case 'contact':
        if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
        if (!formData.email.trim()) newErrors.email = 'Email is required';
        if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
          newErrors.email = 'Please enter a valid email address';
        }
        if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
          newErrors.phone = 'Please enter a valid 10-digit phone number';
        }
        break;

      case 'images':
        if (formData.images.length === 0) {
          newErrors.images = 'At least one image is required';
        }
        break;

      case 'policies':
        if (!formData.check_in_time) newErrors.check_in_time = 'Check-in time is required';
        if (!formData.check_out_time) newErrors.check_out_time = 'Check-out time is required';
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

  const toggleAmenity = (amenity: string) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
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

        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...uploadedUrls],
        }));

        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Uploaded ${uploadedUrls.length} image(s) successfully`,
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

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    if (!validateTab('policies')) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fix the errors before submitting',
      });
      return;
    }

    setIsLoading(true);
    try {
      await propertyAPI.createFromForm({
        ...formData,
        owner_documents: [], // Add document upload if needed
        policies: {},
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Property created successfully!',
      });

      router.back();
    } catch (error: any) {
      console.error('Error creating property:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'Failed to create property',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getProgressPercentage = () => {
    const requiredTabs = TABS.filter((tab) => tab.required);
    const completedRequiredTabs = requiredTabs.filter((tab) => completedTabs.includes(tab.id));
    return (completedRequiredTabs.length / requiredTabs.length) * 100;
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 'basic':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Property Name *</Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                value={formData.name}
                onChangeText={(text) => updateFormData('name', text)}
                placeholder="Grand Palace Hotel"
                placeholderTextColor="#9CA3AF"
              />
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Property Type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {propertyTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      formData.property_type === type && styles.typeButtonActive,
                    ]}
                    onPress={() => updateFormData('property_type', type)}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        formData.property_type === type && styles.typeButtonTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {errors.property_type && <Text style={styles.errorText}>{errors.property_type}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Short Description *</Text>
              <TextInput
                style={[styles.input, errors.short_description && styles.inputError]}
                value={formData.short_description}
                onChangeText={(text) => updateFormData('short_description', text)}
                placeholder="Luxury hotel in the heart of the city"
                placeholderTextColor="#9CA3AF"
              />
              {errors.short_description && (
                <Text style={styles.errorText}>{errors.short_description}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Detailed Description</Text>
              <TextInput
                style={[styles.textArea, errors.description && styles.inputError]}
                value={formData.description}
                onChangeText={(text) => updateFormData('description', text)}
                placeholder="Provide a detailed description..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Base Price (₹/night) *</Text>
                <TextInput
                  style={[styles.input, errors.price && styles.inputError]}
                  value={formData.price}
                  onChangeText={(text) => updateFormData('price', text)}
                  placeholder="2999"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
                {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Star Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {['1', '2', '3', '4', '5'].map((star) => (
                    <TouchableOpacity
                      key={star}
                      style={[
                        styles.starButton,
                        formData.star_category === star && styles.starButtonActive,
                      ]}
                      onPress={() => updateFormData('star_category', star)}
                    >
                      <Text
                        style={[
                          styles.starButtonText,
                          formData.star_category === star && styles.starButtonTextActive,
                        ]}
                      >
                        {star}★
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        );

      case 'location':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Location Details</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Complete Address *</Text>
              <TextInput
                style={[styles.textArea, errors.address && styles.inputError]}
                value={formData.address}
                onChangeText={(text) => updateFormData('address', text)}
                placeholder="123 Main Street, Business District"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />
              {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
            </View>

            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={[styles.input, errors.city && styles.inputError]}
                  value={formData.city}
                  onChangeText={(text) => updateFormData('city', text)}
                  placeholder="Mumbai"
                  placeholderTextColor="#9CA3AF"
                />
                {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>State *</Text>
                <TextInput
                  style={[styles.input, errors.state && styles.inputError]}
                  value={formData.state}
                  onChangeText={(text) => updateFormData('state', text)}
                  placeholder="Maharashtra"
                  placeholderTextColor="#9CA3AF"
                />
                {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Country</Text>
                <TextInput
                  style={styles.input}
                  value={formData.country}
                  onChangeText={(text) => updateFormData('country', text)}
                  placeholder="India"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Pincode *</Text>
                <TextInput
                  style={[styles.input, errors.pincode && styles.inputError]}
                  value={formData.pincode}
                  onChangeText={(text) => updateFormData('pincode', text)}
                  placeholder="400001"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  maxLength={6}
                />
                {errors.pincode && <Text style={styles.errorText}>{errors.pincode}</Text>}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Area/Locality</Text>
                <TextInput
                  style={styles.input}
                  value={formData.area}
                  onChangeText={(text) => updateFormData('area', text)}
                  placeholder="Bandra West"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Nearby Landmark</Text>
                <TextInput
                  style={styles.input}
                  value={formData.landmark}
                  onChangeText={(text) => updateFormData('landmark', text)}
                  placeholder="Near Gateway of India"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
          </View>
        );

      case 'contact':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Contact Information</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                value={formData.phone}
                onChangeText={(text) => updateFormData('phone', text.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                maxLength={10}
              />
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={formData.email}
                onChangeText={(text) => updateFormData('email', text)}
                placeholder="info@grandpalace.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Website (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.website}
                onChangeText={(text) => updateFormData('website', text)}
                placeholder="https://grandpalace.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          </View>
        );

      case 'images':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Property Images</Text>

            <TouchableOpacity
              style={styles.uploadButton}
              onPress={handleImagePick}
              disabled={uploadingImages}
            >
              <Ionicons name="cloud-upload-outline" size={32} color="#1E3A8A" />
              <Text style={styles.uploadButtonText}>
                {uploadingImages ? 'Uploading...' : 'Upload Images'}
              </Text>
              <Text style={styles.uploadButtonSubtext}>PNG, JPG, JPEG up to 10MB each</Text>
            </TouchableOpacity>

            {errors.images && <Text style={styles.errorText}>{errors.images}</Text>}

            {formData.images.length > 0 && (
              <View style={styles.imageGrid}>
                {formData.images.map((image, index) => (
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
        );

      case 'amenities':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Property Amenities</Text>
            <Text style={styles.sectionSubtitle}>Select all amenities available</Text>

            <View style={styles.amenitiesGrid}>
              {amenitiesList.map((amenity) => (
                <TouchableOpacity
                  key={amenity}
                  style={[
                    styles.amenityChip,
                    formData.amenities.includes(amenity) && styles.amenityChipActive,
                  ]}
                  onPress={() => toggleAmenity(amenity)}
                >
                  <Text
                    style={[
                      styles.amenityChipText,
                      formData.amenities.includes(amenity) && styles.amenityChipTextActive,
                    ]}
                  >
                    {amenity}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'policies':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Property Policies</Text>

            <View style={styles.row}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Check-in Time *</Text>
                <TextInput
                  style={[styles.input, errors.check_in_time && styles.inputError]}
                  value={formData.check_in_time}
                  onChangeText={(text) => updateFormData('check_in_time', text)}
                  placeholder="14:00"
                  placeholderTextColor="#9CA3AF"
                />
                {errors.check_in_time && <Text style={styles.errorText}>{errors.check_in_time}</Text>}
              </View>

              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Check-out Time *</Text>
                <TextInput
                  style={[styles.input, errors.check_out_time && styles.inputError]}
                  value={formData.check_out_time}
                  onChangeText={(text) => updateFormData('check_out_time', text)}
                  placeholder="11:00"
                  placeholderTextColor="#9CA3AF"
                />
                {errors.check_out_time && (
                  <Text style={styles.errorText}>{errors.check_out_time}</Text>
                )}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Security Deposit (₹)</Text>
              <TextInput
                style={styles.input}
                value={formData.security_deposit}
                onChangeText={(text) => updateFormData('security_deposit', text)}
                placeholder="5000"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Cancellation Policy</Text>
              <View style={styles.policyButtons}>
                {[
                  { value: 'flexible', label: 'Flexible - Free cancellation up to 24 hours' },
                  { value: 'moderate', label: 'Moderate - 50% refund if cancelled 5 days before' },
                  { value: 'strict', label: 'Strict - Non-refundable' },
                ].map((policy) => (
                  <TouchableOpacity
                    key={policy.value}
                    style={[
                      styles.policyButton,
                      formData.cancellation_policy === policy.value && styles.policyButtonActive,
                    ]}
                    onPress={() => updateFormData('cancellation_policy', policy.value)}
                  >
                    <Text
                      style={[
                        styles.policyButtonText,
                        formData.cancellation_policy === policy.value &&
                          styles.policyButtonTextActive,
                      ]}
                    >
                      {policy.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>House Rules</Text>
              <TextInput
                style={styles.textArea}
                value={formData.house_rules}
                onChangeText={(text) => updateFormData('house_rules', text)}
                placeholder="Any additional rules or guidelines..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
              />
            </View>
          </View>
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
        <Text style={styles.headerTitle}>Add Property</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${getProgressPercentage()}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(getProgressPercentage())}% Complete</Text>
      </View>

      {/* Tab Navigation */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {TABS.map((tab, index) => {
          const isActive = currentTab === tab.id;
          const isCompleted = completedTabs.includes(tab.id);
          const canAccess = canProceedToTab(tab.id);

          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabItem,
                isActive && styles.tabItemActive,
                !canAccess && styles.tabItemDisabled,
              ]}
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
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Text style={[styles.tabNumberText, isActive && styles.tabNumberTextActive]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              {tab.required && !isCompleted && <View style={styles.requiredDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Tab Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderTabContent()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.footerButton, currentTab === 'basic' && styles.footerButtonDisabled]}
          onPress={goToPreviousTab}
          disabled={currentTab === 'basic'}
        >
          <Ionicons name="arrow-back" size={20} color={currentTab === 'basic' ? '#9CA3AF' : '#1E3A8A'} />
          <Text style={[styles.footerButtonText, currentTab === 'basic' && styles.footerButtonTextDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>

        {currentTab !== 'policies' ? (
          <TouchableOpacity
            style={styles.footerButtonPrimary}
            onPress={proceedToNextTab}
          >
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
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <LinearGradient
              colors={['#1E3A8A', '#1E40AF']}
              style={styles.footerButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.footerButtonPrimaryText}>Create Property</Text>
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
    padding: 16,
    backgroundColor: '#fff',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E3A8A',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  tabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabItem: {
    alignItems: 'center',
    marginRight: 24,
  },
  tabItemActive: {},
  tabItemDisabled: {
    opacity: 0.5,
  },
  tabNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  tabNumberActive: {
    backgroundColor: '#1E3A8A',
  },
  tabNumberCompleted: {
    backgroundColor: '#10B981',
  },
  tabNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabNumberTextActive: {
    color: '#fff',
  },
  tabLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#1E3A8A',
    fontWeight: '600',
  },
  requiredDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
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
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#EF4444',
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
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  typeButtonActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  starButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  starButtonActive: {
    backgroundColor: '#FBBF24',
    borderColor: '#FBBF24',
  },
  starButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  starButtonTextActive: {
    color: '#fff',
  },
  uploadButton: {
    height: 200,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E3A8A',
    marginTop: 12,
  },
  uploadButtonSubtext: {
    fontSize: 12,
    color: '#6B7280',
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
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  amenityChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  amenityChipText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  amenityChipTextActive: {
    color: '#fff',
  },
  policyButtons: {
    gap: 12,
  },
  policyButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  policyButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1E3A8A',
  },
  policyButtonText: {
    fontSize: 14,
    color: '#374151',
  },
  policyButtonTextActive: {
    color: '#1E3A8A',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    gap: 8,
  },
  footerButtonDisabled: {
    opacity: 0.5,
  },
  footerButtonText: {
    fontSize: 16,
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
    height: 48,
    gap: 8,
  },
  footerButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});