import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useContext, useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeContext } from "../../Contexts/ThemeContext";

export default function SafraScreen() {
  const navigation = useNavigation();
  const { themeMode } = useContext(ThemeContext);

  const [safras, setSafras] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const [showProdutorModal, setShowProdutorModal] = useState(true);
  const [showPropriedadeModal, setShowPropriedadeModal] = useState(false);

  const [produtores, setProdutores] = useState([]);
  const [filteredProdutores, setFilteredProdutores] = useState([]);
  const [searchProdutor, setSearchProdutor] = useState("");
  const [produtorSelecionado, setProdutorSelecionado] = useState(null);

  const [propriedades, setPropriedades] = useState([]);
  const [propriedadeSelecionada, setPropriedadeSelecionada] = useState(null);
  const [tipoCartao, setTipoCartao] = useState("com");

  const isDark = themeMode === "dark";

  const THEME = isDark
    ? {
      bg: "#111827",
      card: "#1f2937",
      border: "#374151",
      text: "#f3f4f6",
      muted: "#d6c0a6",
      primary: "#c3a382",
      success: "#10B981",
      warning: "#FBBF24",
    }
    : {
      bg: "#fbfaf8",
      card: "#ffffff",
      border: "#efe6dc",
      text: "#533b29",
      muted: "#8b684d",
      primary: "#a37f5e",
      success: "#15803D",
      warning: "#CA8A04",
    };

  const s = styles(THEME);

  // 🔹 Carrega e filtra produtores conforme digitação
  useEffect(() => {

    (async () => {

      try {
        const stored = await AsyncStorage.getItem("@produtores");
        let data = [];

        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed?.model)) data = parsed.model;
          else if (Array.isArray(parsed)) data = parsed;
          else if (Array.isArray(parsed?.data)) data = parsed.data;

          console.log("✅ Produtores carregados:", data.length);
        }

        const texto = searchProdutor.trim().toLowerCase();
        const filtrados = texto.length
          ? data.filter((item) =>
            item?.nomeFantasia?.toLowerCase().includes(texto)
          )
          : data;

        setProdutores(data);
        setFilteredProdutores(filtrados);
      } catch (error) {
        console.error("❌ Erro ao carregar produtores:", error);
        setProdutores([]);
        setFilteredProdutores([]);
      }
    })();
  }, [searchProdutor]);

  // 🧭 Confirma produtor selecionado e salva no AsyncStorage
  const confirmarProdutor = async () => {
    if (!produtorSelecionado) return;

    try {
      await AsyncStorage.setItem(
        "@produtorSelecionado",
        JSON.stringify(produtorSelecionado)
      );
      console.log("🏆 Produtor confirmado:", JSON.stringify(produtorSelecionado));
      console.log("✅ Produtor salvo no AsyncStorage:", produtorSelecionado);
    } catch (error) {
      console.error("❌ Erro ao salvar produtor selecionado:", error);
    }

    setShowProdutorModal(false);
    setShowPropriedadeModal(true);
  };

  // 🧭 Quando abrir o segundo modal, busca propriedades do produtor salvo
  useEffect(() => {
    if (!showPropriedadeModal) return;

    const carregarPropriedades = async () => {
      try {
        let produtor = produtorSelecionado;

        if (!produtor) {
          const storedProdutor = await AsyncStorage.getItem("@produtorSelecionado");
          if (storedProdutor) {
            produtor = JSON.parse(storedProdutor);
          }
        }

        if (!produtor) {
          setPropriedades([]);
          return;
        }

        console.log("🏠 Produtor selecionado:", produtor?.id);

        const enderecosBrutos = Array.isArray(produtor?.enderecos)
          ? produtor.enderecos
          : [];

        const enderecos = enderecosBrutos.map((item, index) => ({
          ...item,
          _localId: index,
          descricaoFormatada:
            item?.descricao ||
            item?.nomePropriedade ||
            item?.nomeFazenda ||
            item?.enderecoLogradouro ||
            "Sem descricao",
        }));

        console.log("[Safra] Propriedades (com cartao) do produtor:",
          enderecos.map((item) => ({
            id:
              item?.id ??
              item?.codigo ??
              item?.codigoIntegracao ??
              item?._localId ??
              null,
            descricao: item?.descricaoFormatada,
          }))
        );
        console.log("[Safra] Total de propriedades (com cartao):", enderecos.length);

        setPropriedades(enderecos);
        setPropriedadeSelecionada(null);
      } catch (error) {
        console.error("? Erro ao carregar propriedades:", error);
        setPropriedades([]);
      }
    };

    carregarPropriedades();
  }, [showPropriedadeModal, produtorSelecionado]);


  // 🧭 Confirma propriedade e salva no AsyncStorage
  const confirmarPropriedade = async () => {
    if (!propriedadeSelecionada) {
      console.warn("?? Selecione uma propriedade antes de confirmar");
      return;
    }

    const dados = {
      tipoCartao,
      propriedade: propriedadeSelecionada,
    };

    try {
      await AsyncStorage.setItem("@propriedadeSelecionada", JSON.stringify(dados));
      console.log("? Propriedade salva no AsyncStorage:", dados);
      navigation.navigate("SafraHome");
    } catch (error) {
      console.error("? Erro ao salvar propriedade:", error);
    }

    setShowPropriedadeModal(false);
  };


  // 🔁 Reabrir seleção
  const trocarSelecao = () => {
    setShowProdutorModal(true);
    setProdutorSelecionado(null);
    setPropriedades([]);
    setTipoCartao("com");
    setPropriedadeSelecionada(null);
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: THEME.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={THEME.bg} />

      {/* 🔹 MODAL 1 - Seleção de Produtor */}
      <Modal visible={showProdutorModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Selecione um Produtor</Text>

            <TextInput
              style={s.input}
              placeholder="Digite o nome do produtor"
              placeholderTextColor={THEME.muted}
              value={searchProdutor}
              onChangeText={setSearchProdutor}
            />

            <FlatList
              data={filteredProdutores}
              keyExtractor={(item, index) =>
                String(item?.codigoCliente || item?.id || index)
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    s.propItem,
                    produtorSelecionado === item && {
                      borderColor: THEME.primary,
                      backgroundColor: THEME.border,
                    },
                  ]}
                  onPress={() => setProdutorSelecionado(item)}
                >
                  <Text style={{ color: THEME.text, fontWeight: "600" }}>
                    {item.nomeFantasia}
                  </Text>
                  <Text style={{ color: THEME.muted, fontSize: 12 }}>
                    {item.cpfCnpj}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[s.empty, { marginTop: 20 }]}>
                  Nenhum produtor encontrado
                </Text>
              }
              style={{ maxHeight: 250, marginBottom: 10 }}
            />

            {produtorSelecionado && (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: THEME.primary,
                  backgroundColor: THEME.border,
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: THEME.text, fontWeight: "700" }}>
                  Selecionado: {produtorSelecionado.nomeFantasia}
                </Text>
              </View>
            )}

            <View style={s.modalButtons}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: THEME.border }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={{ color: THEME.text }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.modalBtn,
                  {
                    backgroundColor: produtorSelecionado
                      ? THEME.primary
                      : THEME.border,
                  },
                ]}
                disabled={!produtorSelecionado}
                onPress={confirmarProdutor}
              >
                <Text
                  style={{
                    color: produtorSelecionado ? "#fff" : THEME.muted,
                  }}
                >
                  Próximo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔹 MODAL 2 - Seleção de Propriedade */}
      <Modal visible={showPropriedadeModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Selecione a Propriedade</Text>

            {/* Lista de propriedades */}
            <FlatList
              data={propriedades}
              keyExtractor={(item, index) => String(index)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    s.propItem,
                    propriedadeSelecionada === item && {
                      borderColor: THEME.primary,
                      backgroundColor: THEME.border,
                    },
                  ]}
                  onPress={() => setPropriedadeSelecionada(item)}
                >
                  <Text style={{ color: THEME.text, fontWeight: "600" }}>
                    {item?.enderecoLogradouro || item?.descricao || item?.nomePropriedade || item?.nomeFazenda || "Sem descrição"}
                  </Text>
                  <Text style={{ color: THEME.muted, fontSize: 12 }}>
                    {item?.municipio || ""} {item?.uf ? `- ${item.uf}` : ""}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[s.empty, { marginTop: 20 }]}>
                  Nenhuma propriedade encontrada.
                </Text>
              }
              style={{ maxHeight: 250, marginBottom: 10 }}
            />

            <View style={s.modalButtons}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: THEME.border }]}
                onPress={trocarSelecao}
              >
                <Text style={{ color: THEME.text }}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.modalBtn,
                  {
                    backgroundColor:
                      propriedadeSelecionada
                        ? THEME.primary
                        : THEME.border,
                  },
                ]}
                disabled={!propriedadeSelecionada}
                onPress={confirmarPropriedade}
              >
                <Text
                  style={{
                    color:
                      propriedadeSelecionada
                        ? "#fff"
                        : THEME.muted,
                  }}
                >
                  Confirmar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function styles(THEME) {
  return StyleSheet.create({
    container: { flex: 1 },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: THEME.card,
      borderRadius: 16,
      padding: 20,
      width: "100%",
      maxWidth: 400,
      maxHeight: "80%",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: THEME.text,
      marginBottom: 14,
      textAlign: "center",
    },
    input: {
      borderWidth: 1,
      borderColor: THEME.border,
      borderRadius: 10,
      padding: 10,
      color: THEME.text,
      marginBottom: 12,
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 10,
    },
    modalBtn: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    propItem: {
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: THEME.border,
      marginVertical: 4,
    },
    empty: {
      textAlign: "center",
      color: THEME.muted,
      fontSize: 14,
    },
  });
}


