import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useContext, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeContext } from "../../Contexts/ThemeContext";
import { resolvePropertyId, resolvePropertyName } from "../../utils/property";

const STORAGE_KEYS = {
  produtor: "@produtorSelecionado",
  propriedade: "@propriedadeSelecionada",
  safras: "@SafrasSalva",
};

const THEME_PALETTE = {
  dark: {
    primary: "#EF4444",
    primaryDark: "#DC2626",
    bg: "#111111",
    card: "#18181B",
    border: "#374151",
    text: "#F9FAFB",
    muted: "#9CA3AF",
    active: "#EF4444",
    inactive: "#4B5563",
  },
  light: {
    primary: "#D92626",
    primaryDark: "#B91C1C",
    bg: "#F3F4F6",
    card: "#FFFFFF",
    border: "#E5E7EB",
    text: "#111827",
    muted: "#6B7280",
    active: "#D92626",
    inactive: "#9CA3AF",
  },
};

const parseJSON = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const extractSafraPropertyId = (safra) => {
  if (!safra) return null;
  if (safra.propriedadeId) return String(safra.propriedadeId);
  return (
    resolvePropertyId(safra.propriedadeInfo) ||
    resolvePropertyId(safra.propriedadeObj) ||
    resolvePropertyId(safra.propriedadeSelecionada) ||
    null
  );
};

const getSafraPropertyName = (safra) => {
  if (!safra) return "";
  return (
    safra.propriedade ||
    safra.propriedadeNome ||
    resolvePropertyName(safra.propriedadeInfo) ||
    resolvePropertyName(safra.propriedadeSelecionada) ||
    ""
  );
};

const buildPropertyMatcher = (propriedade) => {
  const id = resolvePropertyId(propriedade);
  const name = resolvePropertyName(propriedade);
  return {
    id: id ? String(id) : null,
    name: name ? name.toLowerCase().trim() : null,
  };
};

const matchesProperty = (safra, matcher) => {
  if (!matcher.id && !matcher.name) return true;
  const safraId = extractSafraPropertyId(safra);
  if (matcher.id) {
    if (safraId) return String(safraId) === matcher.id;
    if (!matcher.name) return false;
  }
  const safraName = getSafraPropertyName(safra).toLowerCase().trim();
  return matcher.name ? safraName === matcher.name : true;
};

const parseDecimal = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const sumTalhoes = (talhoes, resolver) => {
  if (!Array.isArray(talhoes)) return null;
  let total = 0;
  let hasValue = false;

  talhoes.forEach((talhao) => {
    const raw = resolver(talhao);
    const parsed = parseDecimal(raw);
    if (parsed > 0) {
      total += parsed;
      hasValue = true;
    }
  });

  return hasValue ? total : null;
};

const getProducaoEstimadaTotal = (talhoes) =>
  sumTalhoes(
    talhoes,
    (talhao) =>
      talhao?.prodEstimadaLiquida ??
      talhao?.prodEstimada ??
      talhao?.producaoEstimada
  );

const getProducaoEstimadaBrutaTotal = (talhoes) =>
  sumTalhoes(
    talhoes,
    (talhao) =>
      talhao?.prodEstimadaBruta ??
      talhao?.prodEstimada ??
      talhao?.producaoEstimada
  );

const formatProducao = (value) => {
  if (value === null) return "-";
  return value.toFixed(2);
};

const enrichSafra = (safra) => {
  const totalLiquido = getProducaoEstimadaTotal(safra?.talhoes);
  const totalBruto = getProducaoEstimadaBrutaTotal(safra?.talhoes);
  return {
    ...safra,
    produtorNome:
      safra?.produtor ||
      safra?.produtorInfo?.nomeFantasia ||
      safra?.produtorInfo?.nomeRazaoSocial ||
      "-",
    propriedadeNome: getSafraPropertyName(safra) || "N\u00e3o definida",
    producaoEstimadaTotal: formatProducao(totalLiquido),
    producaoEstimadaBrutaTotal: formatProducao(totalBruto),
    sincronizado: Boolean(safra?.sincronizado),
  };
};

const formatTipoCartao = (tipo) => {
  if (tipo === "com") return "Com Cart\u00e3o";
  if (tipo === "sem") return "Sem Cart\u00e3o";
  return "-";
};

export default function SafraHome() {
  const navigation = useNavigation();
  const { themeMode } = useContext(ThemeContext);

  const [produtor, setProdutor] = useState(null);
  const [propriedade, setPropriedade] = useState(null);
  const [tipoCartao, setTipoCartao] = useState(null);
  const [safras, setSafras] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const isDark = themeMode === "dark";
  const theme = isDark ? THEME_PALETTE.dark : THEME_PALETTE.light;
  const s = styles(theme);

  const loadData = useCallback(async () => {
    try {
      const [produtorRaw, propriedadeRaw, safrasRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.produtor),
        AsyncStorage.getItem(STORAGE_KEYS.propriedade),
        AsyncStorage.getItem(STORAGE_KEYS.safras),
      ]);

      setProdutor(parseJSON(produtorRaw));

      const propriedadeStorage = parseJSON(propriedadeRaw);
      const propriedadeInfo =
        propriedadeStorage?.propriedade ?? propriedadeStorage ?? null;
      setPropriedade(propriedadeInfo);
      setTipoCartao(propriedadeStorage?.tipoCartao ?? null);

      const listaSafras = ensureArray(parseJSON(safrasRaw));
      const matcher = buildPropertyMatcher(propriedadeInfo);

      const filtradas = listaSafras
        .filter((safra) => matchesProperty(safra, matcher))
        .map(enrichSafra);

      setSafras(filtradas);
    } catch (error) {
      console.error("Erro ao carregar dados da SafraHome:", error);
      setSafras([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const tipoCartaoLabel = formatTipoCartao(tipoCartao);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={theme.bg} />

      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => navigation.navigate("MainTab")}
          style={s.iconBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={s.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerText}>
            <Text style={s.headerLabel}>Produtor: </Text>
            {produtor?.nomeFantasia || "-"}
          </Text>
          <Text style={s.headerText}>
            <Text style={s.headerLabel}>Propriedade: </Text>
            {propriedade?.enderecoLogradouro ||
              propriedade?.descricao ||
              "Não definida"}
          </Text>
          <Text style={s.headerText}>
            <Text style={s.headerLabel}>Tipo: </Text>
            {tipoCartaoLabel}
          </Text>
        </View>

        <TouchableOpacity
          style={s.changeBtn}
          onPress={() => navigation.navigate("Safra")}
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={20}
            color={theme.primary}
          />
          <Text style={s.changeText}>Trocar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={safras}
        keyExtractor={(item, index) => String(item?.id || index)}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate("DetalheSafra", { safra: item })}
            style={s.card}
          >
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>{item.safra || "Safra sem nome"}</Text>
              <Ionicons
                name={
                  item.sincronizado
                    ? "cloud-done-outline"
                    : "cloud-offline-outline"
                }
                size={20}
                color={item.sincronizado ? theme.success : theme.warning}
              />
            </View>
            <Text style={s.cardSub}>
              <Text style={s.cardLabel}>Data: </Text>
              {item.data || "-"}</Text>
            <Text style={s.cardSub}>
              <Text style={s.cardLabel}>Produtor: </Text>
              {item.produtorNome}
            </Text>
            <Text style={s.cardSub}>
              <Text style={s.cardLabel}>Propriedade: </Text>
              {item.propriedadeNome}
            </Text>
            <Text style={s.cardSub}>
              <Text style={s.cardLabel}>Producao Bruta: </Text>
              {item.producaoEstimadaBrutaTotal}
            </Text>
            <Text style={s.cardSub}>
              <Text style={s.cardLabel}>Producao Liquida: </Text>
              {item.producaoEstimadaTotal}
            </Text>
            <Text
              style={[
                s.cardStatus,
                { color: item.sincronizado ? theme.success : theme.warning },
              ]}
            >
              {item.sincronizado
                ? "Sincronizado"
                : "Pendente de sincroniza\u00e7\u00e3o"}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={s.empty}>Nenhuma safra cadastrada.</Text>
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation.navigate("CadastroSafra")}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function styles(theme) {
  return StyleSheet.create({
    container: { flex: 1 },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingTop: 8,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },

    headerCard: {
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      marginHorizontal: 12,
      marginTop: 6,
      marginBottom: 10,
      padding: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      elevation: 2,
    },
    headerText: {
      color: theme.text,
      fontSize: 13,
      marginBottom: 2,
    },
    headerLabel: {
      fontWeight: "700",
    },
    changeBtn: {
      alignItems: "center",
    },
    changeText: {
      color: theme.primary,
      fontSize: 12,
      marginTop: 2,
    },

    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.text,
      flex: 1,
    },
    cardSub: { color: theme.muted, fontSize: 13 },
    cardLabel: { fontWeight: "700", color: theme.text },
    cardStatus: {
      marginTop: 6,
      fontWeight: "700",
      fontSize: 13,
    },
    empty: {
      textAlign: "center",
      color: theme.muted,
      marginTop: 40,
      fontSize: 14,
    },

    fab: {
      position: "absolute",
      bottom: 30,
      right: 25,
      backgroundColor: theme.primary,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      elevation: 5,
    },
  });
}
