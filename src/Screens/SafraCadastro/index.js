import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemeContext } from "../../Contexts/ThemeContext";
import { resolvePropertyId, resolvePropertyLogradouro } from "../../utils/property";

const generateGuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch (_error) {
      // fallback below
    }
  }

  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
};

const TIPO_DESCONTO_OPTIONS = [
  { label: "Selecione...", value: "" },
  { label: "Porcentagem (%)", value: "1" },
  { label: "Sacas por HA", value: "2" },
];

const SAFRA_PLACEHOLDER = { label: "Selecione...", value: "" };
const STATIC_SAFRA_DEFAULTS = [
  { label: "2024-2025", value: "2024-2025" },
  { label: "2025-2026", value: "2025-2026" },
];

const FASE_PREVISAO_PLACEHOLDER = { label: "Selecione...", value: "" };
const DEFAULT_FASE_PREVISAO_OPTIONS = [
  FASE_PREVISAO_PLACEHOLDER,
  { label: "Pre-safra", value: "pre-safra" },
  { label: "Pre-colheita", value: "pre-colheita" },
];
const DEFAULT_FASE_PREVISAO_VALUE = FASE_PREVISAO_PLACEHOLDER.value;

const sanitizeTipoDescontoValue = (value) => {
  const allowed = new Set(["1", "2"]);
  if (value === undefined || value === null) return "";
  const trimmed = String(value).trim();
  if (allowed.has(trimmed)) return trimmed;

  const numeric = Number(trimmed);
  if (allowed.has(String(numeric))) {
    return String(numeric);
  }

  return "";
};

const sanitizeLitrosPorPlantaValue = (value) => {
  if (value === undefined || value === null) return "";
  const trimmed = String(value).trim();
  if (trimmed === "") return "";

  const parsed = Number.parseFloat(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) return "";

  const clamped = parsed > 40 ? 40 : parsed;
  let result = clamped.toString();

  if (trimmed.includes(",")) {
    result = result.replace(".", ",");
  }

  return result;
};

const resolveFasePrevisaoId = (value, options) => {
  if (value === undefined || value === null) return "";
  const trimmed = String(value).trim();
  if (trimmed === "") return "";

  const list = Array.isArray(options) ? options : [];
  const matchByValue = list.find((option) => {
    if (!option) return false;
    return String(option.value ?? "").trim() === trimmed;
  });
  if (matchByValue) return String(matchByValue.value);

  const trimmedLower = trimmed.toLowerCase();
  const matchByLabel = list.find((option) => {
    if (!option || option.label === undefined || option.label === null) return false;
    return String(option.label).trim().toLowerCase() === trimmedLower;
  });
  if (matchByLabel) return String(matchByLabel.value);

  return trimmed;
};

const resolveTalhaoId = (talhao) => {
  if (!talhao) return null;

  const raw =
    talhao?.talhaoId ??
    talhao?.talhao?.id ??
    talhao?.idTalhao ??
    talhao?.idtalhao ??
    talhao?.talhaoID ??
    talhao?.codigoTalhao ??
    talhao?.codigo ??
    talhao?.id;

  if (raw === undefined || raw === null) return null;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw);
  }

  return null;
};

const getTipoDescontoLabel = (value) => {
  if (value === undefined || value === null || value === "") return "Selecione...";
  const option = TIPO_DESCONTO_OPTIONS.find((item) => item.value === String(value));
  return option?.label ?? "Selecione...";
};

const getFasePrevisaoLabel = (options, value) => {
  if (!Array.isArray(options) || options.length === 0) return value ? String(value) : "";
  if (value === undefined || value === null || value === "") {
    const placeholder = options.find((item) => item.value === "") ?? options[0];
    return placeholder?.label ?? "";
  }
  const option = options.find((item) => String(item.value) === String(value));
  return option?.label ?? String(value);
};

const normalizeFasePrevisaoSafraOptions = (items) => {
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  return items
    .map((item) => {
      if (!item) return null;

      const statusCandidates = [
        item.statusFasePrevisaoSafra,
        item.status,
        item.ativo,
        item.isAtivo,
      ];
      const rawStatus = statusCandidates.find(
        (candidate) => candidate !== undefined && candidate !== null
      );
      if (rawStatus === undefined) return null;
      const normalizedStatus = Number(rawStatus);
      if (!Number.isFinite(normalizedStatus) || normalizedStatus !== 1) return null;

      const valueCandidates = [
        item.fasePrevisaoSafraId,
        item.id,
        item.codigo,
        item.codigoIntegracao,
        item.value,
      ];
      const rawValue = valueCandidates.find((candidate) => {
        if (candidate === undefined || candidate === null) return false;
        if (typeof candidate === "string" && candidate.trim() === "") return false;
        return true;
      });

      if (rawValue === undefined || rawValue === null) return null;
      const value = String(rawValue);
      if (seen.has(value)) return null;

      const labelCandidates = [
        item.descricao,
        item.nome,
        item.label,
        item.descricaoFase,
        item.descricaoFasePrevisao,
        item.fase,
      ];
      const label =
        labelCandidates.find((candidate) => {
          if (candidate === undefined || candidate === null) return false;
          if (typeof candidate === "string" && candidate.trim() === "") return false;
          return true;
        }) ?? value;

      seen.add(value);
      return { label: String(label), value };
    })
    .filter(Boolean);
};

const getSafraLabel = (options, value) => {
  if (!Array.isArray(options) || options.length === 0) return value ? String(value) : "";
  if (value === undefined || value === null || value === "") {
    const placeholder = options.find((item) => item.value === "") ?? options[0];
    return placeholder?.label ?? "";
  }
  const option = options.find((item) => String(item.value) === String(value));
  return option?.label ?? String(value);
};

const normalizeSafraOptions = (items) => {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items
    .map((item) => {
      if (!item) return null;

      const statusCandidates = [
        item.statusMovimento,
        item.status,
        item.ativo,
        item.isAtivo,
      ];
      const rawStatus = statusCandidates.find(
        (candidate) => candidate !== undefined && candidate !== null
      );
      if (rawStatus === undefined) return null;
      const normalizedStatus = Number(rawStatus);
      if (!Number.isFinite(normalizedStatus) || normalizedStatus !== 1) return null;

      const valueCandidates = [
        item.id,
        item.safraId,
        item.codigo,
        item.codigoIntegracao,
        item.value,
        item.descricao,
        item.anoSafra,
      ];
      const rawValue = valueCandidates.find((candidate) => {
        if (candidate === undefined || candidate === null) return false;
        if (typeof candidate === "string" && candidate.trim() === "") return false;
        return true;
      });
      if (rawValue === undefined || rawValue === null) return null;
      const value = String(rawValue);
      if (seen.has(value)) return null;

      const labelCandidates = [
        item.descricao,
        item.nome,
        item.label,
        item.descricaoSafra,
        item.safra,
        item.anoSafra,
      ];
      const label =
        labelCandidates.find((candidate) => {
          if (candidate === undefined || candidate === null) return false;
          if (typeof candidate === "string" && candidate.trim() === "") return false;
          return true;
        }) ?? value;

      seen.add(value);
      return { label: String(label), value };
    })
    .filter(Boolean);
};

const getSafraSortKey = (option) => {
  if (!option) return null;

  const numericCandidates = [];
  const collect = (raw) => {
    if (raw === undefined || raw === null) return;
    const str = String(raw);
    const yearMatches = str.match(/\d{4}/g);
    if (yearMatches) {
      for (const year of yearMatches) {
        const parsed = Number(year);
        if (Number.isFinite(parsed)) numericCandidates.push(parsed);
      }
    }
    const parsedNumber = Number(str);
    if (Number.isFinite(parsedNumber)) numericCandidates.push(parsedNumber);
  };

  collect(option.anoSafra);
  collect(option.label);
  collect(option.value);

  if (numericCandidates.length === 0) return null;
  return Math.max(...numericCandidates);
};

const sortSafraOptionsDescending = (options) => {
  if (!Array.isArray(options)) return [];

  return [...options].sort((a, b) => {
    const keyA = getSafraSortKey(a);
    const keyB = getSafraSortKey(b);

    if (keyA !== null || keyB !== null) {
      if (keyA === null) return 1;
      if (keyB === null) return -1;
      if (keyA !== keyB) return keyB - keyA;
    }

    const labelA = String(a?.label ?? a?.value ?? "");
    const labelB = String(b?.label ?? b?.value ?? "");
    return labelB.localeCompare(labelA, "pt-BR", { numeric: true, sensitivity: "base" });
  });
};

const DEFAULT_SAFRA_OPTIONS = [
  SAFRA_PLACEHOLDER,
  ...sortSafraOptionsDescending(STATIC_SAFRA_DEFAULTS),
];

export default function SafraCadastro() {
  const navigation = useNavigation();
  const { themeMode } = useContext(ThemeContext);

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

  const s = styles(THEME);

  // 📋 Campos gerais
  const hoje = new Date();
  const dataFormatada = `${String(hoje.getDate()).padStart(2, "0")}/${String(
    hoje.getMonth() + 1
  ).padStart(2, "0")}/${hoje.getFullYear()}`;

  const [showSafraModal, setShowSafraModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [safraOptions, setSafraOptions] = useState(DEFAULT_SAFRA_OPTIONS);
  const [safra, setSafra] = useState(SAFRA_PLACEHOLDER.value);
  const [status, setStatus] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [fasePrevisaoOptions, setFasePrevisaoOptions] = useState(DEFAULT_FASE_PREVISAO_OPTIONS);
  const [fasePrevisao, setFasePrevisao] = useState(DEFAULT_FASE_PREVISAO_VALUE);
  const [loading, setLoading] = useState(false);
  const [produtor, setProdutor] = useState(null);
  const [propriedade, setPropriedade] = useState(null);
  const [tipoCartao, setTipoCartao] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const produtorStr = await AsyncStorage.getItem("@produtorSelecionado");
        const propriedadeStr = await AsyncStorage.getItem("@propriedadeSelecionada");
        if (produtorStr) setProdutor(JSON.parse(produtorStr));
        if (propriedadeStr) {
          const parsed = JSON.parse(propriedadeStr);
          setPropriedade(parsed?.propriedade || null);
          setTipoCartao(parsed?.tipoCartao || null);
        } else {
          setTipoCartao(null);
        }
      } catch (error) {
      }
    })();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSafras = async () => {
      try {
        const stored = await AsyncStorage.getItem("@safrasDisponiveis");
        if (!stored) return;
        const parsed = JSON.parse(stored);
        const normalized = normalizeSafraOptions(parsed);
        if (!isMounted) return;

        if (normalized.length > 0) {
          const combined = sortSafraOptionsDescending(normalized);
          setSafraOptions([SAFRA_PLACEHOLDER, ...combined]);
        } else {
          setSafraOptions(DEFAULT_SAFRA_OPTIONS);
        }
      } catch (error) {
      }
    };

    loadSafras();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!Array.isArray(safraOptions) || safraOptions.length === 0) return;
    const hasCurrentSafra = safraOptions.some(
      (option) => String(option.value) === String(safra)
    );
    if (!hasCurrentSafra && String(safra) !== String(SAFRA_PLACEHOLDER.value)) {
      setSafra(String(SAFRA_PLACEHOLDER.value));
    }
  }, [safraOptions, safra]);

  useEffect(() => {
    let isMounted = true;

    const loadSafraPhases = async () => {
      try {
        const stored = await AsyncStorage.getItem("@fasesPrevisaoSafra");
        if (!stored) return;

        const parsed = JSON.parse(stored);
        const normalized = normalizeFasePrevisaoSafraOptions(parsed);
        if (!isMounted) return;

        if (normalized.length > 0) {
          setFasePrevisaoOptions([
            FASE_PREVISAO_PLACEHOLDER,
            ...normalized,
          ]);
        } else {
          setFasePrevisaoOptions(DEFAULT_FASE_PREVISAO_OPTIONS);
        }
      } catch (error) {
      }
    };

    loadSafraPhases();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!Array.isArray(fasePrevisaoOptions) || fasePrevisaoOptions.length === 0) return;

    const hasCurrentValue = fasePrevisaoOptions.some(
      (option) => String(option.value) === String(fasePrevisao)
    );

    if (!hasCurrentValue) {
      if (String(fasePrevisao) !== String(FASE_PREVISAO_PLACEHOLDER.value)) {
        setFasePrevisao(String(FASE_PREVISAO_PLACEHOLDER.value));
      }
    }
  }, [fasePrevisaoOptions, fasePrevisao]);

  // 🧱 Dados dos talhões
  const [talhoes, setTalhoes] = useState([]);

  const calculateTalhaoMetrics = useCallback((talhao) => {
    if (!talhao) return talhao;
    try {
      const toNumber = (value) => {
        if (value === null || value === undefined) return null;
        const normalized = String(value).replace(",", ".").trim();
        if (normalized === "") return null;
        const parsed = parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        const numeric = Number(value);
        if (Number.isNaN(numeric)) return "";
        if (Math.abs(numeric) < 1e-6) return "";
        return numeric.toFixed(2);
      };

      const firstNumber = (...values) => {
        for (const value of values) {
          if (value !== null && value !== undefined && !Number.isNaN(value)) {
            return value;
          }
        }
        return null;
      };

      const modoEntrada = talhao.modoEntrada === "producao" ? "producao" : "litros";
      const lastEditedField =
        talhao.lastEditedField && ["litros", "prodEstimada", "prodPorHa"].includes(talhao.lastEditedField)
          ? talhao.lastEditedField
          : modoEntrada === "producao"
            ? "prodEstimada"
            : "litros";

      const quantidadePlantas = toNumber(talhao.quantidadePlantas);
      const areaTotal = toNumber(talhao.areaTotalTalhaoHA);

      const litrosInput = toNumber(talhao.litrosPorPlanta);
      const prodEstimadaBrutaInput = toNumber(talhao.prodEstimadaBruta);
      const prodEstimadaStored =
        typeof talhao.prodEstimadaBrutaCalculada === "number"
          ? talhao.prodEstimadaBrutaCalculada
          : typeof talhao.prodEstimadaCalculada === "number"
            ? talhao.prodEstimadaCalculada
            : null;
      const prodEstimadaLegacy = toNumber(talhao.prodEstimada);
      const prodEstimadaBase =
        lastEditedField === "prodEstimada"
          ? firstNumber(prodEstimadaBrutaInput, prodEstimadaLegacy, prodEstimadaStored)
          : firstNumber(prodEstimadaBrutaInput, prodEstimadaStored, prodEstimadaLegacy);
      const prodPorHaInput = toNumber(talhao.prodPorHa);
      const prodEstimadaHaInput = toNumber(talhao.prodEstimadaHa);

      let litros = null;
      let prodEstimada = null;
      let prodPorHa = null;

      const baseField = lastEditedField;

      if (baseField === "litros") {
        if (litrosInput !== null && quantidadePlantas !== null && quantidadePlantas > 0) {
          litros = litrosInput;
          prodEstimada = (quantidadePlantas * litrosInput) / 500;
        }
        if (prodEstimada === null && prodEstimadaBase !== null) {
          prodEstimada = prodEstimadaBase;
          if (quantidadePlantas !== null && quantidadePlantas > 0) {
            litros = (prodEstimadaBase * 500) / quantidadePlantas;
          }
        }
        if (prodEstimada !== null && areaTotal !== null && areaTotal > 0) {
          prodPorHa = prodEstimada / areaTotal;
        } else if (prodPorHaInput !== null) {
          prodPorHa = prodPorHaInput;
          if (areaTotal !== null && areaTotal > 0) {
            prodEstimada = prodPorHaInput * areaTotal;
          }
        }
      } else if (baseField === "prodPorHa") {
        const prodPorHaBase = prodPorHaInput ?? prodEstimadaHaInput;
        if (prodPorHaBase !== null && areaTotal !== null && areaTotal > 0) {
          prodPorHa = prodPorHaBase;
          prodEstimada = prodPorHaBase * areaTotal;
          if (quantidadePlantas !== null && quantidadePlantas > 0) {
            litros = (prodEstimada * 500) / quantidadePlantas;
          }
        } else if (prodEstimadaBase !== null) {
          prodEstimada = prodEstimadaBase;
          if (areaTotal !== null && areaTotal > 0) {
            prodPorHa = prodEstimada / areaTotal;
          }
          if (quantidadePlantas !== null && quantidadePlantas > 0) {
            litros = (prodEstimada * 500) / quantidadePlantas;
          }
        }
      } else {
        if (prodEstimadaBase !== null) {
          prodEstimada = prodEstimadaBase;
          if (areaTotal !== null && areaTotal > 0) {
            prodPorHa = prodEstimada / areaTotal;
          }
          if (quantidadePlantas !== null && quantidadePlantas > 0) {
            litros = (prodEstimada * 500) / quantidadePlantas;
          }
        } else if (prodPorHaInput !== null && areaTotal !== null && areaTotal > 0) {
          prodPorHa = prodPorHaInput;
          prodEstimada = prodPorHaInput * areaTotal;
          if (quantidadePlantas !== null && quantidadePlantas > 0) {
            litros = (prodEstimada * 500) / quantidadePlantas;
          }
        } else if (litrosInput !== null && quantidadePlantas !== null && quantidadePlantas > 0) {
          litros = litrosInput;
          prodEstimada = (quantidadePlantas * litrosInput) / 500;
          if (areaTotal !== null && areaTotal > 0) {
            prodPorHa = prodEstimada / areaTotal;
          }
        }
      }

      if (litros === null && litrosInput !== null) {
        litros = litrosInput;
      }
      if (prodEstimada === null && prodEstimadaBase !== null) {
        prodEstimada = prodEstimadaBase;
      }
      if (prodPorHa === null && prodPorHaInput !== null) {
        prodPorHa = prodPorHaInput;
      } else if (prodPorHa === null && prodEstimadaHaInput !== null) {
        prodPorHa = prodEstimadaHaInput;
      }

      const tipoDesconto = String(talhao.tipoDesconto ?? "").trim();
      const valorDescontoNumero = toNumber(talhao.valorDesconto);

      let prodEstimadaDescontada = prodEstimada;
      if (prodEstimadaDescontada !== null && valorDescontoNumero !== null && valorDescontoNumero > 0) {
        if (tipoDesconto === "1") {
          const desconto = (prodEstimadaDescontada * valorDescontoNumero) / 100;
          prodEstimadaDescontada = Math.max(prodEstimadaDescontada - desconto, 0);
        } else if (tipoDesconto === "2") {
          const areaParaDesconto = firstNumber(
            areaTotal,
            toNumber(talhao.areaTotal),
            toNumber(talhao.area),
            toNumber(talhao.areaCultivavelTalhao),
            toNumber(talhao.areaTotalTalhao)
          );
          if (areaParaDesconto !== null && areaParaDesconto > 0) {
            const desconto = valorDescontoNumero * areaParaDesconto;
            prodEstimadaDescontada = Math.max(prodEstimadaDescontada - desconto, 0);
          }
        }
      }

      const prodEstimadaBrutaString =
        baseField === "prodEstimada"
          ? talhao.prodEstimadaBruta ?? ""
          : prodEstimada !== null
            ? formatValue(prodEstimada)
            : talhao.prodEstimadaBruta || "";

      const prodEstimadaLiquidaString =
        prodEstimadaDescontada !== null
          ? formatValue(prodEstimadaDescontada)
          : talhao.prodEstimadaLiquida || talhao.prodEstimada || "";

      const litrosString =
        baseField === "litros"
          ? talhao.litrosPorPlanta || ""
          : litros !== null
            ? formatValue(litros)
            : "";

      const prodPorHaString =
        baseField === "prodPorHa"
          ? talhao.prodPorHa || talhao.prodEstimadaHa || ""
          : prodPorHa !== null
            ? formatValue(prodPorHa)
            : "";

      const prodEstimadaHaString =
        prodPorHa !== null
          ? formatValue(prodPorHa)
          : prodPorHaString;

      return {
        ...talhao,
        modoEntrada,
        lastEditedField: baseField,
        litrosPorPlanta: litrosString,
        prodEstimada: prodEstimadaLiquidaString,
        prodEstimadaBruta: prodEstimadaBrutaString,
        prodEstimadaLiquida: prodEstimadaLiquidaString,
        prodPorHa: prodPorHaString,
        prodEstimadaHa: prodEstimadaHaString,
        prodEstimadaBrutaCalculada:
          prodEstimada !== null ? Number(prodEstimada.toFixed(6)) : null,
        prodEstimadaLiquidaCalculada:
          prodEstimadaDescontada !== null
            ? Number(prodEstimadaDescontada.toFixed(6))
            : null,
        prodEstimadaCalculada:
          prodEstimada !== null ? Number(prodEstimada.toFixed(6)) : null,
      };
    } catch (error) {
      console.error("[SafraCadastro] Erro ao calcular metricas do talhao:", error);
      return {
        ...talhao,
        prodEstimadaBruta: talhao?.prodEstimadaBruta ?? talhao?.prodEstimada ?? "",
        prodEstimadaLiquida:
          talhao?.prodEstimadaLiquida ?? talhao?.prodEstimada ?? "",
        prodEstimada: talhao?.prodEstimada ?? "",
      };
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadTalhoes = async () => {
      const propriedadeId = resolvePropertyId(propriedade);
      if (!propriedadeId) {
        if (isMounted) setTalhoes([]);
        return;
      }
      try {
        const armazenados = await AsyncStorage.getItem("@talhoes");
        if (!armazenados) {
          if (isMounted) setTalhoes([]);
          return;
        }
        const lista = JSON.parse(armazenados);
        if (!Array.isArray(lista)) {
          if (isMounted) setTalhoes([]);
          return;
        }
        const alvoId = String(propriedadeId).trim();
        const filtrados = lista
          .filter((item) => {
            const talhaoPropId =
              item?.propriedadeId ??
              item?.idPropriedade ??
              item?.propriedadeID;
            if (talhaoPropId === undefined || talhaoPropId === null) return false;
            return String(talhaoPropId).trim() === alvoId;
          })
          .map((item, index) => {
            const resolvedTalhaoId = resolveTalhaoId(item);
            const baseId =
              item?.id ??
              item?.talhaoId ??
              item?.codigo ??
              item?.codigoTalhao ??
              index;

            const hasLitros =
              item?.litrosPorPlanta !== undefined &&
              item?.litrosPorPlanta !== null &&
              String(item?.litrosPorPlanta).trim() !== "";
            const hasProdEstimada =
              item?.prodEstimada !== undefined &&
              item?.prodEstimada !== null &&
              String(item?.prodEstimada).trim() !== "";
            const hasProdPorHa =
              item?.prodPorHa !== undefined &&
              item?.prodPorHa !== null &&
              String(item?.prodPorHa).trim() !== "";

            const modoEntradaDefault =
              item?.modoEntrada === "producao"
                ? "producao"
                : item?.modoEntrada === "litros"
                  ? "litros"
                  : hasLitros
                    ? "litros"
                    : "producao";

            const lastEditedFieldDefault =
              item?.lastEditedField && ["litros", "prodEstimada", "prodPorHa"].includes(item.lastEditedField)
                ? item.lastEditedField
                : modoEntradaDefault === "producao"
                  ? hasProdEstimada
                    ? "prodEstimada"
                    : hasProdPorHa
                      ? "prodPorHa"
                      : "prodEstimada"
                  : "litros";

            return {
              ...item,
              id: String(baseId),
              talhaoId: resolvedTalhaoId ?? null,
              nome:
                item?.nome ||
                item?.descricao ||
                item?.nomeTalhao ||
                `Talhao ${index + 1}`,
              variedadeTalhao: item?.variedadeTalhao || "-",
              areaTotalTalhaoHA: item?.areaTotalTalhaoHA || 0,
              quantidadePlantas: item?.quantidadePlantas
                ? String(item.quantidadePlantas)
                : "",
              litrosPorPlanta: sanitizeLitrosPorPlantaValue(item?.litrosPorPlanta),
              prodPorHa: item?.prodPorHa ? String(item.prodPorHa) : "",
              prodEstimadaBruta:
                item?.prodEstimadaBruta !== undefined && item?.prodEstimadaBruta !== null
                  ? String(item.prodEstimadaBruta)
                  : item?.prodEstimada
                    ? String(item.prodEstimada)
                    : "",
              prodEstimadaLiquida:
                item?.prodEstimadaLiquida !== undefined && item?.prodEstimadaLiquida !== null
                  ? String(item.prodEstimadaLiquida)
                  : item?.prodEstimada
                    ? String(item.prodEstimada)
                    : "",
              prodEstimada: item?.prodEstimada ? String(item.prodEstimada) : "",
              prodEstimadaHa: item?.prodEstimadaHa
                ? String(item.prodEstimadaHa)
                : "",
              tipoDesconto: sanitizeTipoDescontoValue(item?.tipoDesconto),
              valorDesconto:
                item?.valorDesconto !== undefined && item?.valorDesconto !== null
                  ? String(item.valorDesconto)
                  : "",
              historico: Array.isArray(item?.historico)
                ? item.historico
                : [],
              dados: Boolean(item?.dados),
              modoEntrada: modoEntradaDefault,
              lastEditedField: lastEditedFieldDefault,
            };
          });
        if (isMounted) {
          const comCalculo = filtrados.map(calculateTalhaoMetrics);
          setTalhoes(comCalculo);
        }
      } catch (error) {
        if (isMounted) setTalhoes([]);
      }
    };
    loadTalhoes();
    return () => {
      isMounted = false;
    };
  }, [propriedade, calculateTalhaoMetrics]);

  const [talhaoAberto, setTalhaoAberto] = useState(null);
  const [fasePrevisaoModal, setFasePrevisaoModal] = useState(false);
  const [descontoModalTalhao, setDescontoModalTalhao] = useState(null);

  // ⚙️ Atualiza dados individuais do talhão
  const handleLitrosChange = useCallback(
    (id, valor) => {
      const sanitized = sanitizeLitrosPorPlantaValue(valor);

      setTalhoes((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const atualizado = {
            ...t,
            modoEntrada: "litros",
            lastEditedField: "litros",
            litrosPorPlanta: sanitized,
          };
          return calculateTalhaoMetrics(atualizado);
        })
      );
    },
    [calculateTalhaoMetrics]
  );

  const handleProdEstimadaChange = useCallback(
    (id, valor) => {
      setTalhoes((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const atualizado = {
            ...t,
            modoEntrada: "producao",
            lastEditedField: "prodEstimada",
            prodEstimadaBruta: valor,
            prodEstimada: valor,
            prodEstimadaBrutaCalculada: null,
            prodEstimadaCalculada: null,
            prodEstimadaLiquidaCalculada: null,
          };
          return calculateTalhaoMetrics(atualizado);
        })
      );
    },
    [calculateTalhaoMetrics]
  );

  const handleProdPorHaChange = useCallback(
    (id, valor) => {
      setTalhoes((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const atualizado = {
            ...t,
            modoEntrada: "producao",
            lastEditedField: "prodPorHa",
            prodPorHa: valor,
            prodEstimadaHa: valor,
          };
          return calculateTalhaoMetrics(atualizado);
        })
      );
    },
    [calculateTalhaoMetrics]
  );

  const handleTipoDescontoChange = useCallback(
    (id, valor) => {
      const sanitized = sanitizeTipoDescontoValue(valor);
      setTalhoes((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const baseProdEstimada =
            t.prodEstimadaBruta ??
            (t.prodEstimadaBrutaCalculada !== null &&
              t.prodEstimadaBrutaCalculada !== undefined
              ? String(t.prodEstimadaBrutaCalculada)
              : t.prodEstimada ?? "");
          const atualizado = {
            ...t,
            tipoDesconto: sanitized,
            prodEstimadaBruta: baseProdEstimada,
          };
          return calculateTalhaoMetrics(atualizado);
        })
      );
    },
    [calculateTalhaoMetrics]
  );

  const handleValorDescontoChange = useCallback(
    (id, valor) => {
      setTalhoes((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const baseProdEstimada =
            t.prodEstimadaBruta ??
            (t.prodEstimadaBrutaCalculada !== null &&
              t.prodEstimadaBrutaCalculada !== undefined
              ? String(t.prodEstimadaBrutaCalculada)
              : t.prodEstimada ?? "");
          const atualizado = {
            ...t,
            valorDesconto: valor,
            prodEstimadaBruta: baseProdEstimada,
          };
          return calculateTalhaoMetrics(atualizado);
        })
      );
    },
    [calculateTalhaoMetrics]
  );

  const handleModoEntradaChange = useCallback(
    (id, modo) => {
      setTalhoes((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const nextField =
            modo === "litros"
              ? "litros"
              : ["prodEstimada", "prodPorHa"].includes(t.lastEditedField)
                ? t.lastEditedField
                : "prodEstimada";
          const atualizado = {
            ...t,
            modoEntrada: modo,
            lastEditedField: nextField,
          };
          return calculateTalhaoMetrics(atualizado);
        })
      );
    },
    [calculateTalhaoMetrics]
  );

  // 💾 Salvar safra
  const handleSalvarSafra = async () => {
    if (String(safra).trim() === "") {
      Alert.alert("Campos obrigatórios", "Preencha o campo de Safra antes de salvar.");
      setShowSafraModal(true);
      return;
    }

    const fasePrevisaoId = resolveFasePrevisaoId(fasePrevisao, fasePrevisaoOptions);
    if (String(fasePrevisaoId).trim() === "") {
      Alert.alert("Campos obrigat�rios", "Selecione a fase da previsao antes de salvar.");
      setFasePrevisaoModal(true);
      return;
    }

    if (fasePrevisaoId !== fasePrevisao) {
      setFasePrevisao(fasePrevisaoId);
    }

    const safraSelecionada = safraOptions.find(
      (option) => String(option.value) === String(safra)
    );
    const safraIdValor = safraSelecionada?.value ?? safra;
    const safraIdNormalizado =
      safraIdValor === undefined || safraIdValor === null
        ? null
        : String(safraIdValor);
    const safraDescricao = safraSelecionada?.label ?? (safraIdNormalizado ?? "");

    const produtorNome = produtor?.nomeFantasia || "-";
    const propriedadeLogradouro = resolvePropertyLogradouro(propriedade);
    const propriedadeNome = propriedadeLogradouro || "";
    const propriedadeId = resolvePropertyId(propriedade);
    const fasePrevisaoDescricao = getFasePrevisaoLabel(fasePrevisaoOptions, fasePrevisaoId);

    const safraGuid = generateGuid();
    const talhoesParaSalvar = talhoes.map((talhao) => {
      const talhaoIdOriginal = resolveTalhaoId(talhao);
      return {
        ...talhao,
        talhaoId: talhaoIdOriginal ?? null,
        id: generateGuid(),
        previsaoSafraId: safraGuid,
      };
    });

    const novaSafra = {
      id: safraGuid,
      data: dataFormatada,
      safra: safraDescricao,
      safraDescricao,
      safraId: safraIdNormalizado,
      produtor: produtorNome,
      produtorId:
        produtor?.id ??
        produtor?.codigoCliente ??
        produtor?.codigoParceiro ??
        produtor?.codigoIntegracao ??
        produtor?.parceiroNegocioId ??
        produtor?.parceiroId ??
        null,
      parceiroNegocioId:
        produtor?.id ??
        produtor?.codigoCliente ??
        produtor?.parceiroNegocioId ??
        produtor?.parceiroId ??
        produtor?.codigoParceiro ??
        produtor?.codigoIntegracao ??
        null,
      nomeParceiroNegocio: produtorNome,
      produtorCpfCnpj: produtor?.cpfCnpj ?? null,
      produtorInfo: produtor || null,
      propriedade: propriedadeNome,
      nomePropriedade: propriedadeNome,
      status,
      observacoes,
      fasePrevisao: fasePrevisaoId,
      fasePrevisaoSafraId: fasePrevisaoId || null,
      fasePrevisaoDescricao,
      talhoes: talhoesParaSalvar,
      sincronizado: false,
      tipoCartao: tipoCartao || null,
      propriedadeId,
      propriedadeInfo: propriedade || null,
      propriedadeSelecionada: propriedade || null,
      previsaoSafraId: safraGuid,
      codigoIntegracao: safraGuid,
    };

    try {
      setLoading(true);
      const armazenadas = await AsyncStorage.getItem("@SafrasSalva");
      const lista = armazenadas ? JSON.parse(armazenadas) : [];
      lista.push(novaSafra);
      await AsyncStorage.setItem("@SafrasSalva", JSON.stringify(lista));
      setTimeout(() => {
        setLoading(false);
        Alert.alert("Sucesso", "Safra enviada com sucesso!");
        navigation.goBack();
      }, 800);
    } catch (error) {
      setLoading(false);
      Alert.alert("Erro", "Não foi possível salvar a safra. Tente novamente.");
    }
  };

  const handleSalvarTalhao = (talhaoId) => {
    setTalhoes((prev) =>
      prev.map((t) => (t.id === talhaoId ? { ...t, dados: true } : t))
    );
    setTalhaoAberto(null);
  };

  const handleBackPress = () => setConfirmModal("voltar");
  const handleCancelConfirm = () => setConfirmModal(null);
  const handleConfirmExit = () => {
    setConfirmModal(null);
    navigation.goBack();
  };
  const handleSalvarSafraRequest = () => setConfirmModal("salvar");
  const handleConfirmSave = () => {
    setConfirmModal(null);
    handleSalvarSafra();
  };

  const isConfirmModalOpen = Boolean(confirmModal);
  const isBackConfirm = confirmModal === "voltar";
  const confirmTitle = isBackConfirm ? "Deseja sair?" : "Enviar previsão?";
  const confirmMessage = isBackConfirm
    ? "Ao voltar, os dados preenchidos serão perdidos. Deseja realmente sair desta tela?"
    : "Deseja realmente enviar a previsão de safra?";
  const confirmPrimaryAction = isBackConfirm ? handleConfirmExit : handleConfirmSave;
  const confirmPrimaryText = isBackConfirm ? "Sim, sair" : "Sim, enviar";
  const confirmSecondaryText = isBackConfirm ? "Continuar preenchendo" : "Continuar editando";
  const talhaoModalSelecionado = descontoModalTalhao
    ? talhoes.find((item) => item.id === descontoModalTalhao)
    : null;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: THEME.bg }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={THEME.bg} />

      {/* 🔙 Topbar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={handleBackPress} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={THEME.text} />
        </TouchableOpacity>
        <Text style={s.title}>Nova previsão de Safra</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Informações */}
        <View style={s.infoCard}>
          <View style={s.infoBadge}>
            <Ionicons name="person-circle-outline" size={28} color={THEME.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.infoTitle}>Informações da propriedade</Text>
            <Text style={s.infoText}>
              <Text style={s.infoLabel}>Produtor: </Text>
              {produtor?.nomeFantasia || "-"}
            </Text>
            <Text style={s.infoText}>
              <Text style={s.infoLabel}>Propriedade: </Text>
              {propriedade?.enderecoLogradouro || propriedade?.descricao || "Não definida"}
            </Text>
          </View>
        </View>

        {/* Data e Safra */}
        <Text style={s.label}>Data</Text>
        <View style={[s.input, { backgroundColor: THEME.bg, opacity: 0.8 }]}>
          <Text style={{ color: THEME.text }}>{dataFormatada}</Text>
        </View>

        <Text style={s.label}>Safra *</Text>
        <TouchableOpacity style={s.input} onPress={() => setShowSafraModal(true)} activeOpacity={0.7}>
          <Text
            style={{
              color:
                String(safra) === String(SAFRA_PLACEHOLDER.value) ? THEME.muted : THEME.text,
            }}
          >
            {getSafraLabel(safraOptions, safra)}
          </Text>
        </TouchableOpacity>

        {/* Modal Safra */}
        <Modal visible={showSafraModal} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={[s.title, { marginBottom: 10, textAlign: "center" }]}>
                Selecione a Safra
              </Text>
              <Picker
                selectedValue={safra}
                onValueChange={(value) =>
                  setSafra(
                    value === undefined || value === null ? SAFRA_PLACEHOLDER.value : String(value)
                  )
                }
                dropdownIconColor={THEME.text}
                style={{
                  color: isDark ? "#fff" : "#000",
                  backgroundColor: isDark ? "#2d3748" : "#fff",
                  borderRadius: 12,
                }}
              >
                {safraOptions.map((option, index) => (
                  <Picker.Item
                    key={`${option.value ?? "placeholder"}-${index}`}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Picker>
              <TouchableOpacity
                style={[s.modalBtn, { marginTop: 16 }]}
                onPress={() => setShowSafraModal(false)}
              >
                <Text style={s.modalBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Observações */}
        <Text style={s.label}>Observações</Text>
        <TextInput
          style={[s.input, s.textArea]}
          placeholder="Adicione observações gerais sobre a safra..."
          placeholderTextColor={THEME.muted}
          multiline
          value={observacoes}
          onChangeText={setObservacoes}
        />

        <Text style={s.label}>Fase da previsao</Text>
        <TouchableOpacity
          style={s.selectInput}
          activeOpacity={0.75}
          onPress={() => setFasePrevisaoModal(true)}
        >
          <Text style={s.selectText}>{getFasePrevisaoLabel(fasePrevisaoOptions, fasePrevisao)}</Text>
          <Ionicons name="chevron-down" size={16} color={THEME.text} />
        </TouchableOpacity>

        {/* Talhões */}
        <Text style={[s.label, { marginTop: 20 }]}>Talhões</Text>
        <View style={s.sectionDivider} />

        {talhoes.map((t) => {
          const isAberto = talhaoAberto === t.id;
          const hasTipoDesconto =
            t.tipoDesconto !== undefined &&
            t.tipoDesconto !== null &&
            t.tipoDesconto !== "";
          const tipoDescontoLabel = getTipoDescontoLabel(t.tipoDesconto);
          return (
            <View key={t.id} style={s.talhaoCard}>
              <TouchableOpacity
                onPress={() => setTalhaoAberto(isAberto ? null : t.id)}
                activeOpacity={0.8}
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
              >
                <View>
                  <Text style={s.talhaoTitle}>Talhão - {t.nome}</Text>
                  <Text style={{ color: THEME.text }}>Variedade: {t.variedadeTalhao}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ color: THEME.text, marginRight: 8 }}>
                    {t.areaTotalTalhaoHA} (ha)
                  </Text>
                  {t.dados && <Ionicons name="checkmark-circle" size={20} color="limegreen" />}
                </View>
              </TouchableOpacity>

              {isAberto && (
                <View style={{ marginTop: 10 }}>
                  <View style={s.modeToggle}>
                    <TouchableOpacity
                      onPress={() => handleModoEntradaChange(t.id, "litros")}
                      style={[
                        s.modeOption,
                        t.modoEntrada !== "producao" && s.modeOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          s.modeOptionText,
                          t.modoEntrada !== "producao" && s.modeOptionTextActive,
                        ]}
                      >
                        Litros/Planta
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleModoEntradaChange(t.id, "producao")}
                      style={[
                        s.modeOption,
                        t.modoEntrada === "producao" && s.modeOptionActive,
                      ]}
                    >
                      <Text
                        style={[
                          s.modeOptionText,
                          t.modoEntrada === "producao" && s.modeOptionTextActive,
                        ]}
                      >
                        Prod. Estimada
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={s.row}>
                    <View style={s.inputBox}>
                      <Text style={s.smallLabel}>Litros Planta</Text>
                      {t.modoEntrada === "producao" ? (
                        <View style={[s.smallInput, { justifyContent: "center" }]}>
                          <Text style={{ color: THEME.text }}>{t.litrosPorPlanta || "--"}</Text>
                        </View>
                      ) : (
                        <TextInput
                          style={s.smallInput}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor={THEME.muted}
                          value={t.litrosPorPlanta}
                          onChangeText={(v) => handleLitrosChange(t.id, v)}
                        />
                      )}
                    </View>
                    <View style={s.inputBox}>
                      <Text style={s.smallLabel}>Prod. por ha</Text>
                      {t.modoEntrada === "producao" ? (
                        <View style={[s.smallInput, { justifyContent: "center" }]}>
                          <Text style={{ color: THEME.text }}>{t.prodPorHa || "--"}</Text>
                        </View>
                      ) : (
                        <TextInput
                          style={s.smallInput}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor={THEME.muted}
                          value={t.prodPorHa}
                          onChangeText={(v) => handleProdPorHaChange(t.id, v)}
                        />
                      )}
                    </View>
                  </View>

                  <View style={s.row}>
                    <View style={s.inputBox}>
                      <Text style={s.smallLabel}>Quant. Plantas</Text>
                      <View style={[s.smallInput, { justifyContent: "center" }]}>
                        <Text style={{ color: THEME.text }}>
                          {t.quantidadePlantas || "--"}
                        </Text>
                      </View>
                    </View>
                    <View style={s.inputBox}>
                      <Text style={s.smallLabel}>Prod. Estimada Bruta (sc)</Text>
                      {t.modoEntrada === "producao" ? (
                        <TextInput
                          style={s.smallInput}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor={THEME.muted}
                          value={t.prodEstimadaBruta}
                          onChangeText={(v) => handleProdEstimadaChange(t.id, v)}
                        />
                      ) : (
                        <View style={[s.smallInput, { justifyContent: "center" }]}>
                          <Text style={{ color: THEME.text }}>
                            {t.prodEstimadaBruta || "--"}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={s.row}>
                    <View style={s.inputBox}>
                      <Text style={s.smallLabel}>Prod. Estimada Liquida (sc)</Text>
                      <View style={[s.smallInput, { justifyContent: "center" }]}>
                        <Text style={{ color: THEME.text }}>
                          {t.prodEstimadaLiquida || "--"}
                        </Text>
                      </View>
                    </View>
                    <View style={[s.inputBox, { opacity: 0 }]} />
                  </View>

                  <View style={s.row}>
                    <View style={s.inputBox}>
                      <Text style={s.smallLabel}>Tipo de desconto</Text>
                      <TouchableOpacity
                        style={s.selectInput}
                        activeOpacity={0.75}
                        onPress={() => setDescontoModalTalhao(t.id)}
                      >
                        <Text
                          style={hasTipoDesconto ? s.selectText : s.selectPlaceholder}
                        >
                          {tipoDescontoLabel}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color={THEME.text} />
                      </TouchableOpacity>
                    </View>
                    <View style={s.inputBox}>
                      <Text style={s.smallLabel}>Valor desconto</Text>
                      <TextInput
                        style={s.smallInput}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor={THEME.muted}
                        value={t.valorDesconto ?? ""}
                        onChangeText={(v) => handleValorDescontoChange(t.id, v)}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={s.modalBtn}
                    onPress={() => handleSalvarTalhao(t.id)}
                  >
                    <Text style={s.modalBtnText}>Salvar</Text>
                  </TouchableOpacity>

                  {/* Histórico */}
                  {t.historico?.length > 0 && (
                    <View style={{ marginTop: 10 }}>
                      {t.historico.map((h, i) => (
                        <View key={i} style={s.historicoItem}>
                          <Text style={s.historicoText}>
                            {h.previsao} - {h.producao}(Sc)
                          </Text>
                          <Text style={s.historicoText}>{h.data}</Text>
                          <Text style={s.historicoText}>{h.safra}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={fasePrevisaoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setFasePrevisaoModal(false)}
      >
        <View style={s.modalOverlayCenter}>
          <View style={s.modalBoxCenter}>
            <Text style={[s.title, { textAlign: "center", marginBottom: 12 }]}>
              Selecione a fase da previsao
            </Text>
            {fasePrevisaoOptions.map((option) => {
              const isSelected = option.value === fasePrevisao;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[s.modalOption, isSelected && s.modalOptionSelected]}
                  onPress={() => {
                    setFasePrevisao(option.value);
                    setFasePrevisaoModal(false);
                  }}
                >
                  <Text
                    style={[
                      s.modalOptionText,
                      isSelected && s.modalOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[s.modalBtnSecondary, { marginTop: 16 }]}
              onPress={() => setFasePrevisaoModal(false)}
            >
              <Text style={s.modalBtnSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={descontoModalTalhao !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDescontoModalTalhao(null)}
      >
        <View style={s.modalOverlayCenter}>
          <View style={s.modalBoxCenter}>
            <Text style={[s.title, { textAlign: "center", marginBottom: 12 }]}>
              Selecione o tipo de desconto
            </Text>
            {TIPO_DESCONTO_OPTIONS.map((option) => {
              const isSelected =
                option.value === (talhaoModalSelecionado?.tipoDesconto ?? "");
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[s.modalOption, isSelected && s.modalOptionSelected]}
                  onPress={() => {
                    if (descontoModalTalhao) {
                      handleTipoDescontoChange(descontoModalTalhao, option.value);
                    }
                    setDescontoModalTalhao(null);
                  }}
                >
                  <Text
                    style={[
                      s.modalOptionText,
                      isSelected && s.modalOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[s.modalBtnSecondary, { marginTop: 16 }]}
              onPress={() => setDescontoModalTalhao(null)}
            >
              <Text style={s.modalBtnSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isConfirmModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCancelConfirm}
      >
        <View style={s.modalOverlayCenter}>
          <View style={s.modalBoxCenter}>
            <Text style={[s.title, { textAlign: "center", marginBottom: 8 }]}>{confirmTitle}</Text>
            <Text
              style={{
                color: THEME.text,
                textAlign: "center",
                marginBottom: 16,
                fontSize: 14,
              }}
            >
              {confirmMessage}
            </Text>
            <TouchableOpacity style={s.modalBtn} onPress={confirmPrimaryAction}>
              <Text style={s.modalBtnText}>{confirmPrimaryText}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalBtnSecondary} onPress={handleCancelConfirm}>
              <Text style={s.modalBtnSecondaryText}>{confirmSecondaryText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* 🟢 Botão flutuante */}
      <TouchableOpacity style={s.fab} onPress={handleSalvarSafraRequest} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="save-outline" size={28} color="#fff" />}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// 🎨 Estilos
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
      marginTop: 12,
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
    input: {
      backgroundColor: THEME.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: THEME.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: THEME.text,
    },
    textArea: { height: 100, textAlignVertical: "top" },
    sectionDivider: { height: 1, backgroundColor: THEME.primary, marginBottom: 10 },
    talhaoCard: {
      backgroundColor: THEME.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: THEME.border,
      marginBottom: 10,
    },
    talhaoTitle: { fontWeight: "700", color: THEME.text, marginBottom: 5 },
    row: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 10 },
    modeToggle: {
      flexDirection: "row",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: THEME.border,
      marginBottom: 12,
      overflow: "hidden",
    },
    modeOption: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: THEME.card,
    },
    modeOptionActive: {
      backgroundColor: THEME.primary,
    },
    modeOptionText: { fontSize: 12, fontWeight: "600", color: THEME.muted },
    modeOptionTextActive: { color: "#fff" },
    inputBox: { flex: 1 },
    smallLabel: { fontSize: 13, color: THEME.text, marginBottom: 4, fontWeight: "600" },
    smallInput: {
      backgroundColor: THEME.bg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: THEME.border,
      paddingVertical: 8,
      paddingHorizontal: 10,
      height: 45,
      color: THEME.text,
    },
    selectInput: {
      backgroundColor: THEME.bg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: THEME.border,
      paddingHorizontal: 12,
      height: 45,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    selectText: { color: THEME.text, fontSize: 14 },
    selectPlaceholder: { color: THEME.muted, fontSize: 14 },
    modalBox: {
      backgroundColor: THEME.card,
      padding: 16,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalOverlayCenter: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 24,
    },
    modalBoxCenter: {
      backgroundColor: THEME.card,
      padding: 20,
      borderRadius: 16,
    },
    modalBtn: {
      backgroundColor: THEME.primary,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 8,
    },
    modalBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    modalBtnSecondary: {
      backgroundColor: THEME.card,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 8,
      borderWidth: 1,
      borderColor: THEME.border,
    },
    modalBtnSecondaryText: { color: THEME.text, fontWeight: "700", fontSize: 16 },
    modalOption: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: THEME.border,
      backgroundColor: THEME.card,
      marginTop: 8,
    },
    modalOptionSelected: {
      borderColor: THEME.primary,
      backgroundColor: THEME.bg,
    },
    modalOptionText: { color: THEME.text, fontSize: 15, textAlign: "center" },
    modalOptionTextSelected: { color: THEME.primary, fontWeight: "700" },
    historicoItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: THEME.bg,
      borderWidth: 1,
      borderColor: THEME.primary,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginTop: 6,
    },
    historicoText: { color: THEME.text, fontSize: 13 },
    fab: {
      position: "absolute",
      bottom: 25,
      right: 25,
      backgroundColor: THEME.primary,
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
      elevation: 6,
    },
  });
}
