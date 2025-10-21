import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ImageBackground,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { supabase } from '../../lib/supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const backgroundImages = [
  require('../../assets/images/hotel1.jpg'),
  require('../../assets/images/hotel2.jpg'),
  require('../../assets/images/hotel3.jpg'),
  require('../../assets/images/hotel4.jpg'),
  require('../../assets/images/hotel5.jpg'),
];

type FormData = {
  name: string;
  email: string;
  mobile: string;
  password: string;
  confirmPassword: string;
};

type Errors = {
  [key: string]: string;
};

export default function RegisterScreen() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<'signup' | 'success'>('signup');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Errors>({});

  // Background slideshow effect
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setCurrentImageIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateField = (field: keyof FormData, value: string): string => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Full name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        break;
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/\S+@\S+\.\S+/.test(value)) return 'Please enter a valid email address';
        break;
      case 'mobile':
        const cleanMobile = value.replace(/\D/g, '');
        if (!cleanMobile) return 'Mobile number is required';
        if (!/^[6-9]\d{9}$/.test(cleanMobile)) return 'Please enter a valid 10-digit mobile number';
        break;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value))
          return 'Password must contain uppercase, lowercase, and number';
        break;
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== formData.password) return "Passwords don't match";
        break;
      default:
        return '';
    }
    return '';
  };

  const validateSignupForm = (): boolean => {
    const newErrors: Errors = {};
    const fields: (keyof FormData)[] = ['name', 'email', 'mobile', 'password', 'confirmPassword'];

    fields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateSignupForm()) return;

    setIsLoading(true);
    try {
      // Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            mobile: formData.mobile,
          },
        },
      });

      if (authError) {
        console.error('Auth error:', authError);
        if (authError.message.includes('already registered')) {
          setErrors({ email: 'This email is already registered. Please try logging in instead.' });
          Toast.show({
            type: 'error',
            text1: 'Email Already Registered',
            text2: 'This email is already registered. Please try logging in instead.',
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Registration Failed',
            text2: authError.message,
          });
        }
        return;
      }

      if (authData.user) {
        console.log('User created successfully:', authData.user.id);

        // Create entry in hotel_owners table
        const { data: dbData, error: dbError } = await supabase
          .from('hotel_owners')
          .insert([
            {
              id: authData.user.id,
              email: formData.email,
              full_name: formData.name,
              mobile: formData.mobile,
              registration_step: 0,
              company_name: null,
              registration_status: 'profile_setup_pending',
              email_verified: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select();

        if (dbError) {
          console.error('Database error:', dbError);

          // Handle specific database errors
          if (dbError.code === '23505') {
            // Unique violation
            Toast.show({
              type: 'error',
              text1: 'Email Already Exists',
              text2: 'An account with this email already exists. Please try logging in.',
            });
          } else if (dbError.code === '23503') {
            // Foreign key violation
            Toast.show({
              type: 'error',
              text1: 'Authentication Error',
              text2: 'There was an issue with user authentication. Please try again.',
            });
          } else {
            Toast.show({
              type: 'error',
              text1: 'Database Error',
              text2: `Failed to save user data: ${dbError.message}`,
            });
          }
          return;
        }

        console.log('Database entry created:', dbData);

        // Show success toast
        Toast.show({
          type: 'success',
          text1: 'Account Created Successfully!',
          text2: 'Welcome to WriteMyTrip! Your account has been created.',
        });

        // Move to success view
        setCurrentView('success');
        setErrors({});
      }
    } catch (error) {
      console.error('Signup error:', error);
      Toast.show({
        type: 'error',
        text1: 'Unexpected Error',
        text2: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderSignupForm = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerRow}>
          <Ionicons name="person-circle-outline" size={28} color="#007AFF" />
          <Text style={styles.cardTitle}>Create Your Account</Text>
        </View>
        <Text style={styles.cardDescription}>
          Fill in your details to get started as a hospitality partner
        </Text>
      </View>

      <View style={styles.cardContent}>
        {/* Name Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={formData.name}
            onChangeText={(text) => updateFormData('name', text)}
            placeholder="Enter your full legal name"
            placeholderTextColor="#999"
          />
          {errors.name && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color="#FF3B30" />
              <Text style={styles.errorText}>{errors.name}</Text>
            </View>
          )}
        </View>

        {/* Mobile Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Mobile Number *</Text>
          <View style={styles.inputWithIcon}>
            <Ionicons name="call-outline" size={18} color="#999" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.inputWithIconPadding, errors.mobile && styles.inputError]}
              value={formData.mobile}
              onChangeText={(text) => updateFormData('mobile', text)}
              placeholder="+91 98765 43210"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>
          {errors.mobile && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color="#FF3B30" />
              <Text style={styles.errorText}>{errors.mobile}</Text>
            </View>
          )}
        </View>

        {/* Email Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email Address *</Text>
          <View style={styles.inputWithIcon}>
            <Ionicons name="mail-outline" size={18} color="#999" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.inputWithIconPadding, errors.email && styles.inputError]}
              value={formData.email}
              onChangeText={(text) => updateFormData('email', text)}
              placeholder="your@email.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          {errors.email && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color="#FF3B30" />
              <Text style={styles.errorText}>{errors.email}</Text>
            </View>
          )}
        </View>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password *</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={[styles.input, styles.inputWithIconPadding, errors.password && styles.inputError]}
              value={formData.password}
              onChangeText={(text) => updateFormData('password', text)}
              placeholder="Create a strong password"
              placeholderTextColor="#999"
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
          </View>
          {errors.password && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color="#FF3B30" />
              <Text style={styles.errorText}>{errors.password}</Text>
            </View>
          )}
        </View>

        {/* Confirm Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirm Password *</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={[
                styles.input,
                styles.inputWithIconPadding,
                errors.confirmPassword && styles.inputError,
              ]}
              value={formData.confirmPassword}
              onChangeText={(text) => updateFormData('confirmPassword', text)}
              placeholder="Confirm your password"
              placeholderTextColor="#999"
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color="#FF3B30" />
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            </View>
          )}
          {formData.confirmPassword &&
            formData.password === formData.confirmPassword && (
              <View style={styles.successRow}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={styles.successText}>Passwords match</Text>
              </View>
            )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSignup}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#007AFF', '#0051D5']}
            style={styles.gradientButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isLoading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.buttonText}>Creating Account...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="person-add-outline" size={20} color="#fff" />
                <Text style={styles.buttonText}>Create Account</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Login Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.linkText}>Sign in here</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderSuccessView = () => (
    <View style={styles.card}>
      <View style={styles.successContainer}>
        <View style={styles.successIconContainer}>
          <Ionicons name="checkmark-circle" size={60} color="#34C759" />
        </View>

        <Text style={styles.successTitle}>Account Created Successfully!</Text>
        <Text style={styles.successSubtitle}>
          Just verify your email from the link we sent and start listing!
        </Text>
        <Text style={styles.successMessage}>
          We are happy to see you register, {formData.name}!
        </Text>

        <View style={styles.infoBox}>
          <Ionicons name="business-outline" size={20} color="#007AFF" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Next Steps:</Text>
            <Text style={styles.infoDescription}>
              Complete your business profile setup to start receiving bookings. You can add
              property details, upload documents, and complete verification from your dashboard.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={() => router.push('/(tabs)')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#007AFF', '#0051D5']}
            style={styles.gradientButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>Complete Profile Setup</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View style={[styles.backgroundContainer, { opacity: fadeAnim }]}>
        <ImageBackground
          source={backgroundImages[currentImageIndex]}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={styles.overlay} />
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,58,143,0.2)']}
            style={styles.gradientOverlay}
          />
        </ImageBackground>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Join WriteMyTrip as a Partner</Text>
          <Text style={styles.headerSubtitle}>
            Start your journey with our hospitality platform
          </Text>
        </View>

        {currentView === 'signup' ? renderSignupForm() : renderSuccessView()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  headerSubtitle: {
    fontSize: 18,
    color: '#E5E5EA',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 5,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeader: {
    backgroundColor: '#F0F4FF',
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginLeft: 10,
  },
  cardDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 5,
  },
  cardContent: {
    padding: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#C6C6C8',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  inputWithIcon: {
    position: 'relative',
  },
  inputWithIconPadding: {
    paddingLeft: 45,
    paddingRight: 45,
  },
  inputIcon: {
    position: 'absolute',
    left: 15,
    top: 16,
    zIndex: 1,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 15,
    padding: 5,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginLeft: 4,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  successText: {
    fontSize: 12,
    color: '#34C759',
    marginLeft: 4,
  },
  submitButton: {
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  gradientButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  footerText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  linkText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  successContainer: {
    padding: 32,
    alignItems: 'center',
  },
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 18,
  },
  secondaryButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});