import { createStackNavigator } from '@react-navigation/stack';

import Preload from '../Screens/Preload';
import SafraScreen from '../Screens/Safra';
import SafraCadastro from '../Screens/SafraCadastro';
import SafraHome from '../Screens/SafraHome';
import SafraDetalhe from '../Screens/SafraDetalhe';
import SignIn from '../Screens/SignIn';
// import SignUp from '../Screens/SignUp';
import MainTab from './MainTab.android';
import Produto from '../Screens/Produto';

const Stack = createStackNavigator();

export default () => (
  <Stack.Navigator
    initialRouteName="Preload"
    screenOptions={{
      headerShown: false,
    }}>

    <Stack.Screen name="Preload" component={Preload} />
    <Stack.Screen name="SignIn" component={SignIn} />
    {/* <Stack.Screen name="SignUp" component={SignUp} /> */}
    <Stack.Screen name="MainTab" component={MainTab} />
    <Stack.Screen name="Safra" component={SafraScreen} />
    <Stack.Screen name="CadastroSafra" component={SafraCadastro} />
    <Stack.Screen name="SafraHome" component={SafraHome} />
    <Stack.Screen name="DetalheSafra" component={SafraDetalhe} />
    <Stack.Screen name="Produto" component={Produto} />
  </Stack.Navigator>
);
