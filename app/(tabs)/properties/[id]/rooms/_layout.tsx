import { Stack } from 'expo-router';

export default function RoomsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{
          title: 'Room Management',
        }}
      />
      <Stack.Screen 
        name="[roomId]" 
        options={{
          title: 'Room Details',
        }}
      />
    </Stack>
  );
}