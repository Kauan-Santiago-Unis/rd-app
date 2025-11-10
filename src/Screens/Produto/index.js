import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useCallback, useContext, useEffect, useState } from "react";
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
  produtos: "@ProdutosSalvos",
};

const parseJSON = (v) => {
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
};
const ensureArray = (v) => (Array.isArray(v) ? v : []);

const buildPropertyMatcher = (prop) => {
  const id = resolvePropertyId(prop);
  const name = resolvePropertyName(prop);
  return { id: id ? String(id) : null, name: name ? name.toLowerCase().trim() : null };
};

const matchesProperty = (item, matcher) => {
  if (!matcher.id && !matcher.name) return true;
  const pid =
    resolvePropertyId(item?.propriedade) ||
    resolvePropertyId(item?.propriedadeInfo) ||
    resolvePropertyId(item?.propriedadeSelecionada) ||
    resolvePropertyId(item?.fazenda) ||
    null;
  if (matcher.id) {
    if (pid) return String(pid) === matcher.id;
    if (!matcher.name) return false;
  }
  const pname = (
    item?.propriedadeNome ||
    resolvePropertyName(item?.propriedade) ||
    resolvePropertyName(item?.propriedadeInfo) ||
    resolvePropertyName(item?.propriedadeSelecionada) ||
    ""
  ).toLowerCase().trim();
  return matcher.name ? pname === matcher.name : true;
};

const getProdutoNome = (p) => p?.nome || p?.descricao || p?.produto || p?.titulo || "Produto";
const getProdutoCategoria = (p) => p?.categoria || p?.grupo || p?.tipo || "";
const getProdutoUnidade = (p) => p?.unidade || p?.und || p?.uom || "";
const getProdutoQuantidade = (p) => p?.quantidade ?? p?.qtd ?? p?.estoque ?? p?.saldo ?? null;

export default function ProdutoScreen() {
  const { themeMode, colors } = useContext(ThemeContext);
  const [produtor, setProdutor] = useState(null);
  const [propriedade, setPropriedade] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const THEME = colors;
  const s = styles(THEME);

  const loadData = useCallback(async () => {
    try {
      const [produtorRaw, propriedadeRaw, produtosRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.produtor),
        AsyncStorage.getItem(STORAGE_KEYS.propriedade),
        AsyncStorage.getItem(STORAGE_KEYS.produtos),
      ]);

      setProdutor(parseJSON(produtorRaw));

      const propStorage = parseJSON(propriedadeRaw);
      const propInfo = propStorage?.propriedade ?? propStorage ?? null;
      setPropriedade(propInfo);

      let produtosStorage = ensureArray(parseJSON(produtosRaw));
      if (produtosStorage.length === 0) {
        const fallback = await AsyncStorage.getItem("@produtos");
        produtosStorage = ensureArray(parseJSON(fallback));
      }

      const matcher = buildPropertyMatcher(propInfo);
      const list = produtosStorage.filter((p) => matchesProperty(p, matcher));
      setProdutos(list);
    } catch {
      setProdutos([]);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const Header = () => (
    <View style={s.header}>
      <View style={s.infoCard}>
        <Text style={s.infoLabel}>Produtor</Text>
        <Text style={s.infoValue}>
          {produtor?.nomeFantasia || produtor?.nomeRazaoSocial || produtor?.razaoSocial || "-"}
        </Text>
      </View>
      <View style={s.infoCard}>
        <Text style={s.infoLabel}>Propriedade</Text>
        <Text style={s.infoValue}>{resolvePropertyName(propriedade) || "Não definida"}</Text>
      </View>
    </View>
  );

  const renderItem = ({ item }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Ionicons name="pricetags-outline" size={18} color={THEME.muted} />
        <Text style={s.cardTitle}>{getProdutoNome(item)}</Text>
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardText}>
          {getProdutoCategoria(item) ? `Categoria: ${getProdutoCategoria(item)}` : "Categoria: -"}
        </Text>
        <Text style={s.cardText}>
          {getProdutoUnidade(item) ? `Unidade: ${getProdutoUnidade(item)}` : "Unidade: -"}
        </Text>
        <Text style={s.cardText}>
          {getProdutoQuantidade(item) !== null
            ? `Quantidade: ${getProdutoQuantidade(item)}`
            : "Quantidade: -"}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: THEME.bg }]}>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} backgroundColor={THEME.bg} />
      <Header />
      <FlatList
        data={produtos}
        keyExtractor={(item, index) => String(item?.id ?? index)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.muted}
            colors={[THEME.primary]}
          />
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>Nenhum produto encontrado.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={onRefresh}>
              <Text style={s.emptyBtnText}>Atualizar</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function styles(THEME) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 10 },
    infoCard: {
      flex: 1,
      backgroundColor: THEME.card,
      borderWidth: 1,
      borderColor: THEME.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    infoLabel: { color: THEME.muted, fontSize: 12, marginBottom: 4, fontWeight: "600" },
    infoValue: { color: THEME.text, fontSize: 14, fontWeight: "700" },
    card: {
      backgroundColor: THEME.card,
      borderWidth: 1,
      borderColor: THEME.border,
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    cardTitle: { color: THEME.text, fontSize: 16, fontWeight: "700" },
    cardBody: { gap: 2 },
    cardText: { color: THEME.text, fontSize: 13 },
    emptyWrap: { alignItems: "center", marginTop: 40, gap: 12 },
    emptyText: { color: THEME.muted, fontSize: 14 },
    emptyBtn: { backgroundColor: THEME.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    emptyBtnText: { color: "#fff", fontWeight: "700" },
  });
}
