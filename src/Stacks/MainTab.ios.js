// src/Stacks/MainTab.ios.js
import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GlassView } from 'expo-glass-effect';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Home from '../Screens/Home';
import ProfileScreen from '../Screens/Perfil';

const Tab = createBottomTabNavigator();

const COLORS = {
  active: '#0A84FF',
  muted: '#3C3C43', // system gray iOS
  segmentActiveBg: 'rgba(10,132,255,0.14)',
  segmentActiveBorder: 'rgba(10,132,255,0.35)',
};

function PillTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          // pílula “flutuando” um pouco acima do fundo
          paddingBottom: Math.max(insets.bottom, 10) + 8,
        },
      ]}
    >
      <View style={styles.shadow}>
        {/* Pílula menor, largura pelo conteúdo */}
        <View style={styles.pill}>
          {/* Liquid/Glass como fundo absoluto, sem capturar toques */}
          <GlassView
            glassEffectStyle="regular"
            tintColor="systemMaterial"
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />

          {/* Segmentos (botões) por cima do vidro */}
          <View style={styles.row}>
            {state.routes.map((route, index) => {
              const focused = state.index === index;

              const onPress = () => {
                const e = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
              };

              const onLongPress = () => {
                navigation.emit({ type: 'tabLongPress', target: route.key });
              };

              let icon = 'ellipse';
              if (route.name === 'Home') icon = focused ? 'home' : 'home-outline';
              if (route.name === 'Perfil') icon = focused ? 'person' : 'person-outline';

              const label =
                descriptors[route.key].options.tabBarLabel ??
                descriptors[route.key].options.title ??
                route.name;

              return (
                <Pressable
                  key={route.key}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.segment,
                    focused && styles.segmentActive,
                    pressed && !focused && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons
                    name={icon}
                    size={16}
                    color={focused ? COLORS.active : COLORS.muted}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.label,
                      { color: focused ? COLORS.active : COLORS.muted },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      // Injeta a pílula e esconde a tab nativa
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      sceneContainerStyle={{ backgroundColor: 'transparent' }}
    >
      <Tab.Screen name="Home" component={Home} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Perfil" component={ProfileScreen} options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  shadow: {
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  pill: {
    position: 'relative',
    alignSelf: 'center',
    borderRadius: 22,
    overflow: 'hidden',                    // evita “bordas brancas”
    padding: 3,                            // moldura sutil
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'transparent',        // o Glass faz o fundo
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,                                 // pequeno espaço entre segmentos
  },
  segment: {
    // pílula pequena: cada segmento ocupa apenas seu conteúdo
    minWidth: 110,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: COLORS.segmentActiveBg,
    borderWidth: 1,
    borderColor: COLORS.segmentActiveBorder,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
