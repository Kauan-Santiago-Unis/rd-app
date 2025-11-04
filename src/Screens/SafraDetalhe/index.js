import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useContext, useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeContext } from "../../Contexts/ThemeContext";
import { resolvePropertyLogradouro } from "../../utils/property";

const TIPO_DESCONTO_LABELS = {
  "1": "Por\u00e7entagem (%)",
  "2": "Sacas por HA",
};

export default function SafraDetalhe() {
  const navigation = useNavigation();
  const route = useRoute();
  const { themeMode } = useContext(ThemeContext);

  const safraParam = route.params?.safra;
  const [safra, setSafra] = useState(() => enrichSafraData(safraParam));

  const isDark = themeMode === "dark";

  const THEME = useMemo(
    () =>
      isDark
        ? {
          primary: "#c3a382",
          bg: "#111827",
          card: "#1f2937",
          border: "#374151",
          text: "#f3f4f6",
          muted: "#d6c0a6",
        }
        : {
          primary: "#a37f5e",
          bg: "#fbfaf8",
          card: "#ffffff",
          border: "#efe6dc",
          text: "#533b29",
          muted: "#8b684d",
        },
    [isDark]
  );

  useEffect(() => {
    let ativo = true;

    if (!safraParam) {
      setSafra(null);
      return () => {
        ativo = false;
      };
    }

    const paramEnriquecida = enrichSafraData(safraParam);
    setSafra(paramEnriquecida);

    const carregarSafraCompleta = async () => {
      const chave = resolveSafraKey(safraParam);
      if (!chave) {
        return;
      }

      try {
        const armazenadas = await AsyncStorage.getItem("@SafrasSalva");
        if (!armazenadas) {
          return;
        }

        const lista = JSON.parse(armazenadas);
        if (!Array.isArray(lista)) {
          return;
        }

        const encontrada = lista.find((item) => resolveSafraKey(item) === chave);
        if (encontrada && ativo) {
          const combinada = mergeSafraData(encontrada, safraParam);
          setSafra(enrichSafraData(combinada));
        }
      } catch (error) {
        console.error("[SafraDetalhe] Erro ao obter dados da safra:", error);
      }
    };

    carregarSafraCompleta();

    return () => {
      ativo = false;
    };
  }, [safraParam]);

  const s = styles(THEME);

  if (!safra) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: THEME.bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} backgroundColor={THEME.bg} />
        <View style={s.emptyWrapper}>
          <Ionicons name="alert-circle-outline" size={48} color={THEME.muted} />
          <Text style={[s.title, { marginTop: 12 }]}>Nenhum dado encontrado</Text>
          <Text style={{ color: THEME.muted, marginTop: 6, textAlign: "center" }}>
            Volte e selecione uma safra para visualizar os detalhes cadastrados.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const [talhaoAberto, setTalhaoAberto] = useState(null);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: THEME.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={THEME.bg} />

      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={THEME.text} />
        </TouchableOpacity>
        <Text style={s.title}>Detalhes da Safra</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={s.infoCard}>
          <View style={s.infoBadge}>
            <Ionicons name="person-circle-outline" size={28} color={THEME.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.infoTitle}>Informacoes da propriedade</Text>
            <Text style={s.infoText}>
              <Text style={s.infoLabel}>Produtor: </Text>
              {safra.produtor || "-"}
            </Text>
            <Text style={s.infoText}>
              <Text style={s.infoLabel}>Propriedade: </Text>
              {safra.propriedade || "-"}
            </Text>
          </View>
        </View>

        <Text style={s.label}>Data</Text>
        <ReadOnlyInput theme={THEME}>{safra.data || "-"}</ReadOnlyInput>

        <Text style={s.label}>Safra</Text>
        <ReadOnlyInput theme={THEME}>{safra.safra || "-"}</ReadOnlyInput>

        <Text style={s.label}>Observacoes</Text>
        <ReadOnlyInput multiline theme={THEME}>
          {safra.observacoes || "Sem observacoes"}
        </ReadOnlyInput>

        <Text style={s.label}>Fase da previsao</Text>
        <ReadOnlyInput theme={THEME}>
          {safra.fasePrevisaoDescricao || "-"}
        </ReadOnlyInput>

        <Text style={s.label}>Producao Estimada</Text>
        <ReadOnlyInput theme={THEME}>
          {formatNumber(safra.prodEstimada)}
        </ReadOnlyInput>

        <Text style={[s.label, { marginTop: 20 }]}>Talhoes</Text>
        <View style={s.sectionDivider} />

        {Array.isArray(safra.talhoes) && safra.talhoes.length > 0 ? (
          safra.talhoes.map((talhao, index) => {
            const key = talhao.id ?? String(index);
            const isAberto = talhaoAberto === key;
            return (
              <View key={key} style={s.talhaoCard}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setTalhaoAberto(isAberto ? null : key)}
                  style={s.talhaoHeader}
                >
                  <View>
                    <Text style={s.talhaoTitle}>
                      Talhao - {talhao.nome || `Talhao ${index + 1}`}
                    </Text>
                    <Text style={s.infoText}>
                      <Text style={s.infoLabel}>Variedade: </Text>
                      {talhao.variedade || "-"}
                    </Text>
                  </View>

                  <View style={s.talhaoSummary}>
                    <Text style={s.infoText}>{formatNumber(talhao.area)} (ha)</Text>
                    {talhao.dados && (
                      <Ionicons name="checkmark-circle" size={18} color="limegreen" />
                    )}
                    <Ionicons
                      name={isAberto ? "chevron-up-outline" : "chevron-down-outline"}
                      size={18}
                      color={THEME.text}
                    />
                  </View>
                </TouchableOpacity>

                {isAberto && (
                  <View style={s.talhaoDetalhe}>
                    <View style={s.row}>
                      <View style={s.inputBox}>
                        <Text style={s.smallLabel}>Litros Planta</Text>
                        <View style={[s.smallInput, s.readOnlyBox]}>
                          <Text style={s.readOnlyText}>
                            {formatNumber(talhao.litrosPorPlanta)}
                          </Text>
                        </View>
                      </View>
                      <View style={s.inputBox}>
                        <Text style={s.smallLabel}>Prod. por ha</Text>
                        <View style={[s.smallInput, s.readOnlyBox]}>
                          <Text style={s.readOnlyText}>
                            {formatNumber(talhao.prodPorHa)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={s.row}>
                      <View style={s.inputBox}>
                        <Text style={s.smallLabel}>Quant. Planta</Text>
                        <View style={[s.smallInput, s.readOnlyBox]}>
                          <Text style={s.readOnlyText}>{talhao.quantPlantas || "--"}</Text>
                        </View>
                      </View>
                      <View style={s.inputBox}>
                        <Text style={s.smallLabel}>Prod. Estimada Bruta</Text>
                        <View style={[s.smallInput, s.readOnlyBox]}>
                          <Text style={s.readOnlyText}>
                            {formatNumber(talhao.prodEstimadaBruta)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={s.row}>
                      <View style={s.inputBox}>
                        <Text style={s.smallLabel}>Prod. Estimada Liquida</Text>
                        <View style={[s.smallInput, s.readOnlyBox]}>
                          <Text style={s.readOnlyText}>
                            {formatNumber(talhao.prodEstimadaLiquida)}
                          </Text>
                        </View>
                      </View>
                      <View style={[s.inputBox, s.readOnlyPlaceholder]} />
                    </View>

                    <View style={s.row}>
                      <View style={s.inputBox}>
                        <Text style={s.smallLabel}>Tipo de desconto</Text>
                        <View style={[s.smallInput, s.readOnlyBox]}>
                          <Text style={s.readOnlyText}>
                            {getTipoDescontoLabel(talhao.tipoDesconto)}
                          </Text>
                        </View>
                      </View>
                      <View style={s.inputBox}>
                        <Text style={s.smallLabel}>Valor desconto</Text>
                        <View style={[s.smallInput, s.readOnlyBox]}>
                          <Text style={s.readOnlyText}>
                            {formatValorDesconto(
                              talhao.valorDesconto,
                              talhao.tipoDesconto
                            )}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {Array.isArray(talhao.historico) && talhao.historico.length > 0 && (
                      <View style={s.historicoWrapper}>
                        <Text style={s.historicoTitle}>Historico</Text>
                        {talhao.historico.map((h, idx) => (
                          <View key={idx} style={s.historicoItem}>
                            <Text style={s.historicoText}>
                              {h.previsao || "-"} - {formatNumber(h.producao)}(Sc)
                            </Text>
                            <Text style={s.historicoText}>{h.data || "-"}</Text>
                            <Text style={s.historicoText}>{h.safra || "-"}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <Text style={{ color: THEME.muted, marginTop: 8 }}>Nenhum talhao cadastrado.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReadOnlyInput({ children, multiline, theme }) {
  return (
    <View
      style={[
        readOnlyStyles.input(theme),
        multiline ? readOnlyStyles.multiline : null,
      ]}
    >
      <Text
        style={[
          readOnlyStyles.text(theme),
          multiline ? readOnlyStyles.textMultiline : null,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

const readOnlyStyles = {
  input: (THEME) => ({
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: THEME.text,
    minHeight: 48,
    justifyContent: "center",
  }),
  multiline: {
    minHeight: 100,
    paddingVertical: 14,
  },
  text: (THEME) => ({
    color: THEME.text,
    fontSize: 15,
  }),
  textMultiline: {
    lineHeight: 20,
  },
};

function styles(THEME) {
  return StyleSheet.create({
    container: { flex: 1 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      paddingTop: Platform.OS === "android" ? 10 : 0,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: THEME.border,
      backgroundColor: THEME.card,
    },
    title: { fontSize: 18, fontWeight: "800", color: THEME.text },
    label: {
      color: THEME.text,
      fontWeight: "700",
      fontSize: 14,
      marginTop: 18,
      marginBottom: 6,
    },
    infoCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: THEME.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: THEME.border,
      padding: 14,
      marginTop: 4,
      marginBottom: 20,
      elevation: 3,
    },
    infoBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      backgroundColor: THEME.bg,
      borderWidth: 1,
      borderColor: THEME.border,
    },
    infoTitle: {
      color: THEME.text,
      fontWeight: "700",
      fontSize: 14,
      marginBottom: 6,
    },
    infoText: { color: THEME.text, fontSize: 13, marginBottom: 4 },
    infoLabel: { fontWeight: "700", color: THEME.text },
    sectionDivider: { height: 1, backgroundColor: THEME.primary, marginBottom: 10 },
    talhaoCard: {
      backgroundColor: THEME.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: THEME.border,
      marginBottom: 10,
    },
    row: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 10 },
    inputBox: { flex: 1 },
    smallLabel: { fontSize: 13, color: THEME.muted, marginBottom: 4, fontWeight: "600" },
    smallInput: {
      backgroundColor: THEME.bg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: THEME.border,
      paddingVertical: 8,
      paddingHorizontal: 10,
      minHeight: 45,
    },
    talhaoTitle: { fontWeight: "700", color: THEME.text, marginBottom: 6 },
    talhaoHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    talhaoSummary: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    talhaoDetalhe: {
      marginTop: 12,
      backgroundColor: THEME.card,
      borderWidth: 1,
      borderColor: THEME.border,
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    historicoWrapper: {
      marginTop: 12,
      gap: 8,
    },
    historicoTitle: {
      fontWeight: "700",
      color: THEME.text,
      fontSize: 13,
    },
    historicoItem: {
      backgroundColor: THEME.bg,
      borderWidth: 1,
      borderColor: THEME.primary,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginTop: 6,
    },
    historicoText: { color: THEME.text, fontSize: 13 },
    readOnlyBox: {
      justifyContent: "center",
    },
    readOnlyText: {
      color: THEME.text,
    },
    readOnlyPlaceholder: {
      flex: 1,
      opacity: 0,
    },
    emptyWrapper: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
  });
}

function resolveSafraKey(item) {
  if (!item) return null;
  const candidatos = [
    item.id,
    item.previsaoSafraId,
    item.codigoIntegracao,
    item.safraId,
  ];

  for (const candidato of candidatos) {
    if (candidato === undefined || candidato === null) continue;
    if (typeof candidato === "string") {
      const valor = candidato.trim();
      if (valor.length > 0) return valor;
      continue;
    }
    if (typeof candidato === "number" && !Number.isNaN(candidato)) {
      return String(candidato);
    }
  }

  return null;
}

function mergeSafraData(primary, fallback) {
  if (!primary && !fallback) return null;
  if (!primary) return fallback ? { ...fallback } : null;
  if (!fallback) return { ...primary };

  const merged = { ...fallback };
  const keys = new Set([
    ...Object.keys(fallback ?? {}),
    ...Object.keys(primary ?? {}),
  ]);

  for (const key of keys) {
    const value = primary[key];
    if (!isEmptyValue(value)) {
      merged[key] = value;
    }
  }

  return merged;
}

function enrichSafraData(data) {
  if (!data) return null;

  const produtorInfo =
    data.produtorInfo ||
    data.produtorSelecionado ||
    data.produtor;

  const propriedadeInfo =
    data.propriedadeInfo ||
    data.propriedadeSelecionada ||
    data.propriedadeObj;

  const enriquecida = {
    ...data,
  };

  enriquecida.produtor = pickFirstValue(
    data.produtor,
    produtorInfo?.nomeFantasia,
    produtorInfo?.nomeRazaoSocial,
    produtorInfo?.razaoSocial,
    produtorInfo?.nome
  );

  enriquecida.nomeParceiroNegocio = pickFirstValue(
    data.nomeParceiroNegocio,
    data.produtor,
    produtorInfo?.nomeFantasia,
    produtorInfo?.nomeRazaoSocial
  );

  enriquecida.produtorCpfCnpj = pickFirstValue(
    data.produtorCpfCnpj,
    produtorInfo?.cpfCnpj,
    produtorInfo?.cnpj,
    produtorInfo?.cpf
  );

  const propriedadeLogradouro = pickFirstValue(
    typeof data.propriedade === "string" ? data.propriedade : null,
    typeof data.nomePropriedade === "string" ? data.nomePropriedade : null,
    resolvePropertyLogradouro(propriedadeInfo),
    resolvePropertyLogradouro(
      typeof data.propriedade === "object" ? data.propriedade : null
    ),
    resolvePropertyLogradouro(
      typeof data.nomePropriedade === "object" ? data.nomePropriedade : null
    ),
    data.enderecoLogradouro
  );

  enriquecida.nomePropriedade = propriedadeLogradouro || "";

  enriquecida.propriedade = pickFirstValue(
    propriedadeLogradouro,
    data.propriedade,
    data.nomePropriedade,
    propriedadeInfo?.nomeFazenda,
    propriedadeInfo?.descricaoFormatada
  );

  enriquecida.propriedadeId = pickFirstValue(
    data.propriedadeId,
    propriedadeInfo?.id,
    propriedadeInfo?._localId
  );

  enriquecida.data = pickFirstValue(
    data.data,
    data.dataMovimento,
    data.dataCadastro,
    data.dataLancamento
  );

  enriquecida.observacoes = pickFirstValue(
    data.observacoes,
    data.observacoesLancamento,
    data.observacoesMovimento,
    ""
  );

  const prodEstimadaInicial = pickFirstValue(
    data.prodEstimada,
    data.prodEstimadaHa,
    data.producaoEstimada
  );

  const fasePrevisaoInfo =
    (typeof data.fasePrevisao === "object" ? data.fasePrevisao : null) ||
    data.fasePrevisaoInfo ||
    data.fasePrevisaoDados ||
    data.fasePrevisaoObj;

  enriquecida.fasePrevisaoDescricao = pickFirstValue(
    data.fasePrevisaoDescricao,
    fasePrevisaoInfo?.descricao,
    fasePrevisaoInfo?.nome,
    fasePrevisaoInfo?.descricaoFase
  );

  enriquecida.fasePrevisaoId = pickFirstValue(
    data.fasePrevisaoSafraId,
    data.fasePrevisaoId,
    fasePrevisaoInfo?.id
  );

  const talhoesValidos = Array.isArray(data.talhoes) ? data.talhoes : [];
  const detalhes = Array.isArray(data.detalhes) ? data.detalhes : [];
  if (talhoesValidos.length === 0 && detalhes.length > 0) {
    enriquecida.talhoes = detalhes;
  }
  let producaoCalculada = null;
  if (Array.isArray(enriquecida.talhoes)) {
    enriquecida.talhoes = enriquecida.talhoes.map((talhao, index) =>
      normalizeTalhao(talhao, index)
    );
    producaoCalculada = sumTalhoesProducao(enriquecida.talhoes);
  }

  enriquecida.producaoEstimadaCalculada = producaoCalculada;
  enriquecida.prodEstimada =
    producaoCalculada ??
    (isEmptyValue(prodEstimadaInicial) ? null : prodEstimadaInicial);

  return enriquecida;
}

function normalizeTalhao(data, index = 0) {
  if (!data) return data;

  const normalizado = {
    ...data,
  };

  normalizado.nome = pickFirstValue(
    data.nome,
    data.nomeTalhao
  );

  if (isEmptyValue(normalizado.nome)) {
    normalizado.nome = `Talhao ${index + 1}`;
  }

  normalizado.variedade = pickFirstValue(
    data.variedade,
    data.variedadeTalhao,
    data.variedadePrincipal
  );

  normalizado.area = pickFirstValue(
    data.area,
    data.areaTotal,
    data.areaTotalTalhao,
    data.areaTotalTalhaoHA,
    data.areaCultivavelTalhao
  );

  normalizado.quantPlantas = pickFirstValue(
    data.quantPlantas,
    data.quantidadePlantas,
    data.totalPlantas,
    data.quantidadeCovasTalhao
  );

  normalizado.litrosPorPlanta = pickFirstValue(
    data.litrosPorPlanta,
    data.litros,
    data.litrosPlanta
  );

  normalizado.prodEstimadaBruta = pickFirstValue(
    data.prodEstimadaBruta,
    data.prodEstimadaBrutaCalculada,
    data.prodEstimadaCalculada,
    data.producaoEstimada,
    data.prodEstimada
  );

  normalizado.prodEstimadaLiquida = pickFirstValue(
    data.prodEstimadaLiquida,
    data.producaoLiquida,
    data.prodEstimada
  );

  normalizado.prodEstimada = pickFirstValue(
    normalizado.prodEstimadaLiquida,
    normalizado.prodEstimadaBruta
  );

  normalizado.prodPorHa = pickFirstValue(
    data.prodPorHa,
    data.producaoPorHa,
    data.prodEstimadaHa
  );

  normalizado.tipoDesconto = pickFirstValue(
    data.tipoDesconto,
    data.tipoDescontoId,
    data.tipoDescontoTalhao
  );

  normalizado.valorDesconto = pickFirstValue(
    data.valorDesconto,
    data.descontoValor
  );

  normalizado.latitude = pickFirstValue(
    data.latitude,
    data.latitudeTalhao
  );

  normalizado.longitude = pickFirstValue(
    data.longitude,
    data.longitudeTalhao
  );

  normalizado.altitude = pickFirstValue(
    data.altitude,
    data.altitudeTalhao
  );

  normalizado.dataPlantio = pickFirstValue(
    data.dataPlantio,
    data.dataPlantioTalhao
  );

  normalizado.modoEntrada = pickFirstValue(
    data.modoEntrada,
    data.modo
  );

  if (typeof data.dados === "boolean") {
    normalizado.dados = data.dados;
  } else {
    normalizado.dados = Boolean(
      !isEmptyValue(normalizado.prodEstimada) ||
      !isEmptyValue(normalizado.quantPlantas)
    );
  }

  return normalizado;
}

function pickFirstValue(...values) {
  for (const value of values) {
    if (!isEmptyValue(value)) {
      return value;
    }
  }
  return values.length > 0 ? values[values.length - 1] : undefined;
}

function isEmptyValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function getTipoDescontoLabel(value) {
  if (value === undefined || value === null) return "-";
  const key = String(value).trim();
  if (!key) return "-";
  return TIPO_DESCONTO_LABELS[key] ?? "-";
}

function parseDecimal(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function sumTalhoesProducao(talhoes) {
  if (!Array.isArray(talhoes)) return null;
  let total = 0;
  let hasValue = false;

  talhoes.forEach((talhao) => {
    const valor = parseDecimal(
      talhao?.prodEstimadaLiquida ??
      talhao?.prodEstimada ??
      talhao?.producaoEstimada
    );
    if (valor > 0) {
      total += valor;
      hasValue = true;
    }
  });

  return hasValue ? total : null;
}

function formatValorDesconto(value, tipo) {
  if (isEmptyValue(value)) return "-";
  const parsed = parseDecimal(value);
  if (!Number.isFinite(parsed)) return String(value);
  const formatted = formatNumber(parsed);
  if (formatted === "-") return "-";

  const tipoStr =
    tipo === undefined || tipo === null ? "" : String(tipo).trim();
  if (tipoStr === "1") {
    return `${formatted}%`;
  }
  return formatted;
}

function formatNumber(value) {
  if (value === undefined || value === null || value === "") return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return value;
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(number);
}
