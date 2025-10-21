import { Stack } from 'expo-router';

export default function BookingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{
          title: 'Bookings',
        }}
      />
      <Stack.Screen 
        name="new" 
        options={{
          title: 'New Booking',
          presentation: 'modal',
        }}
      />
      <Stack.Screen 
        name="[id]" 
        options={{
          title: 'Booking Details',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}