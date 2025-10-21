import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  RefreshControl,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from '../../../lib/supabaseClient';

const { width } = Dimensions.get('window');

const steps = [
  { id: 1, title: 'Business Information', description: 'Property & business details', icon: 'office-building' },
  { id: 2, title: 'KYC Verification', description: 'Identity & bank verification', icon: 'shield-check' },
];

const documentTypes = [
  { value: 'pan_card', label: 'PAN Card', required: true, description: 'Valid PAN card copy' },
  { value: 'aadhaar_card', label: 'Aadhaar Card', required: true, description: 'Aadhaar card copy' },
  { value: 'bank_document', label: 'Bank Document', required: true, description: 'Bank passbook or statement' },
  { value: 'business_registration', label: 'Business Registration', required: false, description: 'Trade license or GST certificate' },
];

const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
];

const businessTypes = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'resort', label: 'Resort' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'apartment', label: 'Service Apartment' },
  { value: 'homestay', label: 'Homestay' },
  { value: 'chain', label: 'Hotel Chain' },
  { value: 'villa', label: 'Villa' },
  { value: 'guesthouse', label: 'Guest House' },
  { value: 'boutique', label: 'Boutique Hotel' },
  { value: 'lodge', label: 'Lodge' },
];

export default function KYCProfileScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [kycStatus, setKycStatus] = useState('pending');
  const [authUser, setAuthUser] = useState<any>(null);
  const [showStateModal, setShowStateModal] = useState(false);
  const [showBusinessTypeModal, setShowBusinessTypeModal] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    hotelName: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    businessType: '',
    businessDescription: '',
    isBusinessOwner: false,
    ownerName: '',
    ownerMobile: '',
    ownerEmail: '',
    panNumber: '',
    aadhaarNumber: '',
    passportNumber: '',
    bankAccountNumber: '',
    confirmBankAccount: '',
    ifscCode: '',
    bankName: '',
    bankBranch: '',
    accountHolderName: '',
    accountType: '',
    agreeToTerms: false,
    agreeToPrivacy: false,
    agreeToProcessing: false,
    uploadedDocuments: {} as Record<string, any[]>,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    checkUserAndLoadData();
  }, []);

  const checkUserAndLoadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      setAuthUser(user);

      const { data: ownerData, error } = await supabase
        .from('owner_kyc')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading data:', error);
        return;
      }

      if (ownerData) {
        if (ownerData.registration_step >= 2) setCurrentStep(2);
        setKycStatus(ownerData.kyc_status || 'pending');
        
        setFormData(prev => ({
          ...prev,
          hotelName: ownerData.hotel_name || '',
          address: ownerData.address || '',
          city: ownerData.city || '',
          state: ownerData.state || '',
          pincode: ownerData.pincode || '',
          landmark: ownerData.landmark || '',
          businessType: ownerData.business_type || '',
          businessDescription: ownerData.business_description || '',
          isBusinessOwner: ownerData.is_business_owner || false,
          ownerName: ownerData.owner_name || '',
          ownerMobile: ownerData.owner_mobile || '',
          ownerEmail: ownerData.owner_email || '',
          panNumber: ownerData.pan_number || '',
          aadhaarNumber: ownerData.aadhaar_number || '',
          passportNumber: ownerData.passport_number || '',
          bankAccountNumber: ownerData.bank_account_number || '',
          confirmBankAccount: ownerData.bank_account_number || '',
          ifscCode: ownerData.ifsc_code || '',
          bankName: ownerData.bank_name || '',
          bankBranch: ownerData.bank_branch || '',
          accountHolderName: ownerData.account_holder_name || '',
          accountType: ownerData.account_type || '',
          agreeToTerms: ownerData.agree_to_terms || false,
          agreeToPrivacy: ownerData.agree_to_privacy || false,
          agreeToProcessing: ownerData.agree_to_processing || false,
          uploadedDocuments: ownerData.documents || {},
        }));
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    checkUserAndLoadData();
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateCurrentStep = () => {
    if (currentStep === 1) {
      const requiredFields = formData.isBusinessOwner
        ? ['hotelName', 'address', 'city', 'state', 'pincode', 'businessType', 'ownerName', 'ownerMobile', 'ownerEmail']
        : ['hotelName', 'address', 'city', 'state', 'pincode', 'ownerName', 'ownerMobile'];
      
      return requiredFields.every(field => formData[field]?.toString().trim() !== '');
    }
    
    if (currentStep === 2) {
      const requiredDocs = documentTypes.filter(doc => doc.required);
      return requiredDocs.every(doc => {
        const uploadedDoc = formData.uploadedDocuments[doc.value];
        return uploadedDoc && uploadedDoc.length > 0;
      });
    }
    
    return true;
  };

  const uploadFileToSupabase = async (file: any, path: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${path}/${fileName}`;

      // For React Native, we need to handle file upload differently
      const formDataUpload = new FormData();
      formDataUpload.append('file', {
        uri: file.uri,
        type: file.mimeType,
        name: file.name,
      } as any);

      const { error } = await supabase.storage
        .from('kyc-documents')
        .upload(filePath, formDataUpload);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('kyc-documents')
        .getPublicUrl(filePath);

      return {
        path: filePath,
        url: publicUrl,
        name: file.name,
        size: file.size,
        type: file.mimeType,
      };
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  };

  const handleFileUpload = async (docType: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      if (file.size && file.size > 5 * 1024 * 1024) {
        Alert.alert('Error', 'File size exceeds 5MB');
        return;
      }

      setUploadingDoc(docType);

      const uploadedFile = await uploadFileToSupabase(file, `${authUser.id}/kyc-documents`);

      const newFile = {
        id: Date.now(),
        ...uploadedFile,
      };

      updateFormData('uploadedDocuments', {
        ...formData.uploadedDocuments,
        [docType]: [...(formData.uploadedDocuments[docType] || []), newFile],
      });

      await saveStepData(2, {
        documents: {
          ...formData.uploadedDocuments,
          [docType]: [...(formData.uploadedDocuments[docType] || []), newFile],
        },
      });

      Alert.alert('Success', 'Document uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload document');
    } finally {
      setUploadingDoc(null);
    }
  };

  const removeDocument = async (docType: string, fileId: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to remove this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentDocs = formData.uploadedDocuments[docType] || [];
              const fileToDelete = currentDocs.find(doc => doc.id === fileId);
              const updatedDocs = currentDocs.filter(doc => doc.id !== fileId);

              updateFormData('uploadedDocuments', {
                ...formData.uploadedDocuments,
                [docType]: updatedDocs,
              });

              if (fileToDelete?.path) {
                await supabase.storage.from('kyc-documents').remove([fileToDelete.path]);
              }

              await saveStepData(2, {
                documents: {
                  ...formData.uploadedDocuments,
                  [docType]: updatedDocs,
                },
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to remove document');
            }
          },
        },
      ]
    );
  };

  const saveStepData = async (stepNumber: number, data: any) => {
    if (!authUser) return false;

    try {
      const updateData = {
        registration_step: stepNumber,
        updated_at: new Date().toISOString(),
        ...data,
      };

      const { error } = await supabase
        .from('owner_kyc')
        .upsert({ user_id: authUser.id, ...updateData }, { onConflict: 'user_id' });

      if (error) {
        console.error('Error saving step data:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in saveStepData:', error);
      return false;
    }
  };

  const handleNext = async () => {
    const isValid = validateCurrentStep();
    
    if (!isValid) {
      Alert.alert('Incomplete', 'Please fill in all required fields');
      return;
    }

    setSaving(true);

    try {
      if (currentStep === 1) {
        const step1Data = {
          hotel_name: formData.hotelName,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          landmark: formData.landmark,
          business_type: formData.businessType,
          business_description: formData.businessDescription,
          is_business_owner: formData.isBusinessOwner,
          owner_name: formData.ownerName,
          owner_mobile: formData.ownerMobile,
          owner_email: formData.ownerEmail,
        };

        const saved = await saveStepData(1, step1Data);
        if (!saved) {
          Alert.alert('Error', 'Failed to save data');
          setSaving(false);
          return;
        }
      }

      if (currentStep < steps.length) {
        setCurrentStep(prev => prev + 1);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const requiredDocs = documentTypes.filter(doc => doc.required);
    const missingDocs = requiredDocs.filter(doc => {
      const uploadedDoc = formData.uploadedDocuments[doc.value];
      return !uploadedDoc || uploadedDoc.length === 0;
    });

    if (missingDocs.length > 0) {
      Alert.alert('Missing Documents', `Please upload: ${missingDocs.map(d => d.label).join(', ')}`);
      return;
    }

    if (!formData.agreeToTerms || !formData.agreeToPrivacy || !formData.agreeToProcessing) {
      Alert.alert('Terms Required', 'Please accept all terms and conditions');
      return;
    }

    setSaving(true);

    try {
      const kycData = {
        pan_number: formData.panNumber,
        aadhaar_number: formData.aadhaarNumber.replace(/\s/g, ''),
        passport_number: formData.passportNumber,
        bank_account_number: formData.bankAccountNumber,
        ifsc_code: formData.ifscCode,
        bank_name: formData.bankName,
        bank_branch: formData.bankBranch,
        account_holder_name: formData.accountHolderName,
        account_type: formData.accountType,
        documents: formData.uploadedDocuments,
        agree_to_terms: formData.agreeToTerms,
        agree_to_privacy: formData.agreeToPrivacy,
        agree_to_processing: formData.agreeToProcessing,
        registration_step: 2,
        kyc_status: 'under_review',
      };

      const saved = await saveStepData(2, kycData);

      if (saved) {
        await supabase
          .from('owner_kyc')
          .update({ kyc_status: 'under_review', updated_at: new Date().toISOString() })
          .eq('user_id', authUser.id);

        Alert.alert(
          'Success',
          'KYC documents submitted successfully! Your documents are now under review.',
          [{ text: 'OK', onPress: () => checkUserAndLoadData() }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit KYC');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={styles.loadingText}>Loading your KYC status...</Text>
      </View>
    );
  }

  if (kycStatus === 'verified') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.centerContent}>
        <View style={styles.statusCard}>
          <View style={[styles.statusIcon, { backgroundColor: '#10b981' }]}>
            <Icon name="check-circle" size={48} color="#ffffff" />
          </View>
          <Text style={styles.statusTitle}>KYC Verification Complete</Text>
          <Text style={styles.statusDescription}>
            Your account has been successfully verified and is ready to use.
          </Text>
          <TouchableOpacity style={styles.dashboardButton} onPress={() => router.push('/')}>
            <Text style={styles.dashboardButtonText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (kycStatus === 'under_review') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.centerContent}>
        <View style={[styles.statusCard, { backgroundColor: '#fef3c7' }]}>
          <View style={[styles.statusIcon, { backgroundColor: '#f59e0b' }]}>
            <Icon name="clock-outline" size={48} color="#ffffff" />
          </View>
          <Text style={styles.statusTitle}>Documents Under Review</Text>
          <Text style={styles.statusDescription}>
            We're currently verifying your submitted documents. This process typically takes 24-48 hours.
          </Text>
          <TouchableOpacity
            style={[styles.dashboardButton, { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f59e0b' }]}
            onPress={() => router.push('/')}
          >
            <Text style={[styles.dashboardButtonText, { color: '#f59e0b' }]}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const progress = (currentStep / steps.length) * 100;
  const isStepValid = validateCurrentStep();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Complete Your KYC</Text>
          <Text style={styles.headerSubtitle}>Verify your identity to start receiving bookings</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Pending KYC</Text>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>Step {currentStep} of {steps.length}</Text>
            <Text style={styles.progressPercent}>{Math.round(progress)}% Complete</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        {/* Step Indicators */}
        <View style={styles.stepsContainer}>
          {steps.map(step => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            
            return (
              <View
                key={step.id}
                style={[
                  styles.stepIndicator,
                  isActive && styles.stepIndicatorActive,
                  isCompleted && styles.stepIndicatorCompleted,
                ]}
              >
                <View
                  style={[
                    styles.stepIcon,
                    isActive && styles.stepIconActive,
                    isCompleted && styles.stepIconCompleted,
                  ]}
                >
                  <Icon
                    name={isCompleted ? 'check' : step.icon}
                    size={24}
                    color={isActive || isCompleted ? '#ffffff' : '#64748b'}
                  />
                </View>
                <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            );
          })}
        </View>

        {/* Step Content */}
        <View style={styles.contentCard}>
          <Text style={styles.contentTitle}>{steps[currentStep - 1].title}</Text>
          <Text style={styles.contentDescription}>{steps[currentStep - 1].description}</Text>

          {currentStep === 1 && (
            <View style={styles.formContainer}>
              {/* Business Owner Checkbox */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => updateFormData('isBusinessOwner', !formData.isBusinessOwner)}
              >
                <Icon
                  name={formData.isBusinessOwner ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={24}
                  color="#1e3a8a"
                />
                <View style={styles.checkboxLabel}>
                  <Text style={styles.checkboxTitle}>I am a business owner</Text>
                  <Text style={styles.checkboxDescription}>Hotel/Resort/Commercial Property</Text>
                </View>
              </TouchableOpacity>

              {/* Property Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  {formData.isBusinessOwner ? 'Hotel/Business Name *' : 'Property Name *'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.hotelName}
                  onChangeText={text => updateFormData('hotelName', text)}
                  placeholder="Enter property name"
                />
              </View>

              {/* Business Type (if business owner) */}
              {formData.isBusinessOwner && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Business Type *</Text>
                  <TouchableOpacity
                    style={styles.selectInput}
                    onPress={() => setShowBusinessTypeModal(true)}
                  >
                    <Text style={formData.businessType ? styles.selectText : styles.selectPlaceholder}>
                      {formData.businessType
                        ? businessTypes.find(t => t.value === formData.businessType)?.label
                        : 'Select business type'}
                    </Text>
                    <Icon name="chevron-down" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Address */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Property Address *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.address}
                  onChangeText={text => updateFormData('address', text)}
                  placeholder="Enter complete address"
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* City, State, Pincode */}
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>City *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.city}
                    onChangeText={text => updateFormData('city', text)}
                    placeholder="City"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Pincode *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.pincode}
                    onChangeText={text => updateFormData('pincode', text)}
                    placeholder="000000"
                    keyboardType="numeric"
                    maxLength={6}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>State *</Text>
                <TouchableOpacity style={styles.selectInput} onPress={() => setShowStateModal(true)}>
                  <Text style={formData.state ? styles.selectText : styles.selectPlaceholder}>
                    {formData.state || 'Select state'}
                  </Text>
                  <Icon name="chevron-down" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Owner Details */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contact Person Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.ownerName}
                  onChangeText={text => updateFormData('ownerName', text)}
                  placeholder="Full name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contact Mobile *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.ownerMobile}
                  onChangeText={text => updateFormData('ownerMobile', text)}
                  placeholder="+91 98765 43210"
                  keyboardType="phone-pad"
                />
              </View>

              {formData.isBusinessOwner && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Contact Email *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.ownerEmail}
                    onChangeText={text => updateFormData('ownerEmail', text)}
                    placeholder="contact@hotel.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              )}
            </View>
          )}

          {currentStep === 2 && (
            <View style={styles.formContainer}>
              {/* Identity Verification */}
              <Text style={styles.sectionTitle}>Identity Verification</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>PAN Number *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.panNumber}
                  onChangeText={text => updateFormData('panNumber', text.toUpperCase())}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Aadhaar Number *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.aadhaarNumber}
                  onChangeText={text => {
                    const cleaned = text.replace(/\D/g, '');
                    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
                    if (cleaned.length <= 12) {
                      updateFormData('aadhaarNumber', formatted);
                    }
                  }}
                  placeholder="1234 5678 9012"
                  keyboardType="numeric"
                />
              </View>

              {/* Bank Details */}
              <Text style={styles.sectionTitle}>Bank Account Details</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Account Holder Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.accountHolderName}
                  onChangeText={text => updateFormData('accountHolderName', text)}
                  placeholder="As per bank records"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Bank Account Number *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.bankAccountNumber}
                  onChangeText={text => updateFormData('bankAccountNumber', text)}
                  placeholder="Account number"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Account Number *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.confirmBankAccount}
                  onChangeText={text => updateFormData('confirmBankAccount', text)}
                  placeholder="Re-enter account number"
                  keyboardType="numeric"
                />
                {formData.confirmBankAccount &&
                  formData.bankAccountNumber === formData.confirmBankAccount && (
                    <Text style={styles.successText}>✓ Account numbers match</Text>
                  )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>IFSC Code *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.ifscCode}
                  onChangeText={text => updateFormData('ifscCode', text.toUpperCase())}
                  placeholder="SBIN0001234"
                  maxLength={11}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Bank Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.bankName}
                  onChangeText={text => updateFormData('bankName', text)}
                  placeholder="State Bank of India"
                />
              </View>

              {/* Document Upload */}
              <Text style={styles.sectionTitle}>Document Upload</Text>

              {documentTypes.map(docType => {
                const isUploaded = formData.uploadedDocuments[docType.value]?.length > 0;
                const isUploading = uploadingDoc === docType.value;

                return (
                  <View key={docType.value} style={styles.documentCard}>
                    <View style={styles.documentHeader}>
                      <View style={styles.documentInfo}>
                        <Text style={styles.documentTitle}>{docType.label}</Text>
                        {docType.required && (
                          <View style={styles.requiredBadge}>
                            <Text style={styles.requiredText}>Required</Text>
                          </View>
                        )}
                      </View>
                      {isUploaded && (
                        <Icon name="check-circle" size={20} color="#10b981" />
                      )}
                    </View>
                    <Text style={styles.documentDescription}>{docType.description}</Text>

                    {isUploaded ? (
                      <View style={styles.uploadedFiles}>
                        {formData.uploadedDocuments[docType.value].map((file: any) => (
                          <View key={file.id} style={styles.fileItem}>
                            <Icon name="file-document" size={20} color="#1e3a8a" />
                            <Text style={styles.fileName}>{file.name}</Text>
                            <TouchableOpacity onPress={() => removeDocument(docType.value, file.id)}>
                              <Icon name="delete" size={20} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={() => handleFileUpload(docType.value)}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <ActivityIndicator size="small" color="#1e3a8a" />
                        ) : (
                          <>
                            <Icon name="upload" size={20} color="#1e3a8a" />
                            <Text style={styles.uploadButtonText}>Upload Document</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {/* Terms and Conditions */}
              <View style={styles.termsContainer}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => updateFormData('agreeToTerms', !formData.agreeToTerms)}
                >
                  <Icon
                    name={formData.agreeToTerms ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={24}
                    color="#1e3a8a"
                  />
                  <Text style={styles.termsText}>I agree to Terms of Service</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => updateFormData('agreeToPrivacy', !formData.agreeToPrivacy)}
                >
                  <Icon
                    name={formData.agreeToPrivacy ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={24}
                    color="#1e3a8a"
                  />
                  <Text style={styles.termsText}>I acknowledge Privacy Policy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => updateFormData('agreeToProcessing', !formData.agreeToProcessing)}
                >
                  <Icon
                    name={formData.agreeToProcessing ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={24}
                    color="#1e3a8a"
                  />
                  <Text style={styles.termsText}>I consent to data processing</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Navigation Buttons */}
        <View style={styles.navigation}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setCurrentStep(prev => prev - 1)}
              disabled={saving}
            >
              <Text style={styles.backButtonText}>Previous</Text>
            </TouchableOpacity>
          )}

          {currentStep < steps.length ? (
            <TouchableOpacity
              style={[styles.nextButton, (!isStepValid || saving) && styles.buttonDisabled]}
              onPress={handleNext}
              disabled={!isStepValid || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.nextButtonText}>Next Step</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!formData.agreeToTerms || !formData.agreeToPrivacy || !formData.agreeToProcessing || saving) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={
                !formData.agreeToTerms || !formData.agreeToPrivacy || !formData.agreeToProcessing || saving
              }
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Icon name="shield-check" size={20} color="#ffffff" />
                  <Text style={styles.submitButtonText}>Submit KYC</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* State Modal */}
      <Modal visible={showStateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)}>
                <Icon name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {indianStates.map(state => (
                <TouchableOpacity
                  key={state}
                  style={styles.modalItem}
                  onPress={() => {
                    updateFormData('state', state);
                    setShowStateModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{state}</Text>
                  {formData.state === state && <Icon name="check" size={20} color="#1e3a8a" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Business Type Modal */}
      <Modal visible={showBusinessTypeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Business Type</Text>
              <TouchableOpacity onPress={() => setShowBusinessTypeModal(false)}>
                <Icon name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {businessTypes.map(type => (
                <TouchableOpacity
                  key={type.value}
                  style={styles.modalItem}
                  onPress={() => {
                    updateFormData('businessType', type.value);
                    setShowBusinessTypeModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{type.label}</Text>
                  {formData.businessType === type.value && <Icon name="check" size={20} color="#1e3a8a" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  centerContent: {
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#dbeafe',
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  statusBadgeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  progressCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
  },
  progressPercent: {
    fontSize: 14,
    color: '#64748b',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1e3a8a',
  },
  stepsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  stepIndicator: {
    flex: 1,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  stepIndicatorActive: {
    borderColor: '#1e3a8a',
    backgroundColor: '#dbeafe',
  },
  stepIndicatorCompleted: {
    borderColor: '#10b981',
    backgroundColor: '#dcfce7',
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepIconActive: {
    backgroundColor: '#1e3a8a',
  },
  stepIconCompleted: {
    backgroundColor: '#10b981',
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 4,
  },
  stepTitleActive: {
    color: '#1e3a8a',
  },
  stepDescription: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
  },
  contentCard: {
    backgroundColor: '#ffffff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  contentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  contentDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  formContainer: {
    gap: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#dbeafe',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  checkboxLabel: {
    flex: 1,
    marginLeft: 12,
  },
  checkboxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  checkboxDescription: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectText: {
    fontSize: 14,
    color: '#0f172a',
  },
  selectPlaceholder: {
    fontSize: 14,
    color: '#94a3b8',
  },
  rowInputs: {
    flexDirection: 'row',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
    marginTop: 8,
    marginBottom: 12,
  },
  successText: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 4,
  },
  documentCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  requiredBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '600',
  },
  documentDescription: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  uploadedFiles: {
    gap: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 6,
  },
  fileName: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
  },
  termsContainer: {
    gap: 12,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#dbeafe',
    borderRadius: 8,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    marginLeft: 8,
  },
  navigation: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  backButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  nextButton: {
    flex: 2,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#1e3a8a',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#1e3a8a',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  modalList: {
    flex: 1,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemText: {
    fontSize: 15,
    color: '#0f172a',
  },
  statusCard: {
    backgroundColor: '#dcfce7',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  dashboardButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  dashboardButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});