import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Alert } from "react-native";
import { navigationRef, resetTo } from "../utils/navigation";
import { resolvePropertyId, resolvePropertyLogradouro } from "../utils/property";
import { ApiError, api } from "./api";

export class SyncError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "SyncError";
    this.code = options.code;
    this.details = options.details;
    this.cause = options.cause;
  }
}

const STATUS = {
  CHECKING_CONNECTION: "Verificando conexao...",
  OFFLINE: "Sem conexao com a internet",
  AUTH_MISSING: "Usuario nao autenticado",
  AUTH_CORRUPTED: "Dados do usuario invalidos",
  AUTH_EXPIRED: "Sessao expirada. Faca login novamente.",
  VENDOR_MISSING: "ID do vendedor nao encontrado",
  PRODUCERS: "Sincronizando produtores...",
  PROPERTIES: "Sincronizando propriedades sem cartao...",
  TALHOES: "Sincronizando talhoes...",
  SAFRA_LIST: "Sincronizando safras...",
  SAFRA_PHASES: "Sincronizando fases de safra...",
  LOCAL_SAFRAS: "Preparando safras para sincronizacao...",
  SAFRAS_REMOTE: "Sincronizando previsoes de safra...",
  SUCCESS: "Tudo sincronizado",
};

export const getStatusLabels = () => STATUS;

const withStatus = (callback, message) => {
  if (typeof callback === "function") {
    callback(message);
  }
};

const SAFRAS_STORAGE_KEY = "@SafrasSalva";
const SAFRA_LIST_STORAGE_KEY = "@safrasDisponiveis";
const SAFRA_PHASES_STORAGE_KEY = "@fasesPrevisaoSafra";
const SAFRA_ENDPOINT =
  "http://192.168.2.10:7077/api/PrevisaoSafra";
const SAFRA_LIST_ENDPOINT =
  "http://192.168.2.10:7081/api/v1/Safra";
const SAFRA_PHASES_ENDPOINT =
  "http://192.168.2.10:7077/api/FasePrevisaoSafra";

const AUTH_STORAGE_KEYS = ["@accessToken", "@userDetails"];
const SESSION_ALERT = {
  title: "Sessao expirada",
  message: "Seu login expirou. Faca login novamente.",
};

const tryResetToSignIn = () => {
  if (resetTo("SignIn")) return true;
  if (!navigationRef.isReady()) {
    setTimeout(() => {
      resetTo("SignIn");
    }, 250);
  }
  return false;
};

const handleSessionExpired = async (onStatus) => {
  withStatus(onStatus, STATUS.AUTH_EXPIRED);

  try {
    await AsyncStorage.multiRemove(AUTH_STORAGE_KEYS);
  } catch (_error) {
    // ignore failures when clearing credentials
  }

  Alert.alert(SESSION_ALERT.title, SESSION_ALERT.message, [
    {
      text: "OK",
      onPress: () => {
        tryResetToSignIn();
      },
    },
  ]);

  tryResetToSignIn();
};

const pickFirst = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
};

const ensureId = () => {
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

const GUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isGuidLike = (value) => {
  if (typeof value !== "string") return false;
  return GUID_REGEX.test(value.trim());
};

const toIsoOrNull = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const direct = new Date(trimmed);
    if (!Number.isNaN(direct.getTime())) {
      return direct.toISOString();
    }

    const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      const parsed = new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
      );
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
  }

  return null;
};

const toIsoDate = (value) => toIsoOrNull(value) ?? new Date().toISOString();

const toNumberOrNull = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    let normalized = value.trim();
    if (!normalized) return null;

    const hasComma = normalized.includes(",");
    if (hasComma && normalized.includes(".")) {
      normalized = normalized.replace(/\./g, "");
    }

    normalized = normalized.replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeNumber = (value, fallback = 0) => {
  const parsed = toNumberOrNull(value);
  return parsed === null ? fallback : parsed;
};

const normalizeTipoDesconto = (value) => {
  const parsed = toNumberOrNull(value);
  if (parsed === 1 || parsed === 2) return parsed;
  return 0;
};

const normalizeFasePrevisaoSafraId = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  if (isGuidLike(trimmed)) return trimmed;
  const numeric = toNumberOrNull(trimmed);
  if (numeric !== null) return String(numeric);
  return null;
};

const STATUS_PREVISAO_MAP = {
  planejada: 0,
  planejado: 0,
  "em andamento": 1,
  andamento: 1,
  emexecucao: 1,
  executando: 1,
  concluida: 2,
  concluido: 2,
  finalizada: 2,
  finalizado: 2,
  colhida: 2,
  cancelada: 3,
  cancelado: 3,
};

const mapTalhoesToDetalhes = (talhoes, previsaoSafraId) => {
  if (!Array.isArray(talhoes)) return [];

  return talhoes.map((talhao, index) => {
    const detailId = ensureId();
    const talhaoId = resolveTalhaoId(talhao);

    const culturaId = pickFirst(
      talhao?.culturaId,
      talhao?.idCultura,
      talhao?.culturaID
    );
    const variedadeId = pickFirst(
      talhao?.variedadeId,
      talhao?.idVariedade,
      talhao?.variedadeTalhaoId
    );

    return {
      id: String(detailId),
      culturaId: culturaId ?? 0,
      nomeCultura:
        pickFirst(
          talhao?.nomeCultura,
          talhao?.cultura,
          talhao?.descricaoCultura
        ) ?? "",
      areaProducao: normalizeNumber(
        pickFirst(
          talhao?.areaProducao,
          talhao?.areaTotalTalhao,
          talhao?.area,
          talhao?.areaHa
        )
      ),
      qtdProducaoPrevisto: normalizeNumber(
        pickFirst(
          talhao?.qtdProducaoPrevisto,
          talhao?.prodEstimadaBruta,
          talhao?.prodEstimadaBrutaCalculada,
          talhao?.prodEstimada,
          talhao?.producaoPrevista,
          talhao?.producaoEstimada
        )
      ),
      nivelTecnologico:
        pickFirst(
          talhao?.nivelTecnologico,
          talhao?.nivelTecnico,
          talhao?.nivel
        ) ?? 0,
      previsaoSafraId: String(previsaoSafraId),
      dataInicio: toIsoDate(
        pickFirst(
          talhao?.dataInicio,
          talhao?.inicioAtividade,
          talhao?.dataMovimento,
          talhao?.data
        )
      ),
      dataFim: toIsoDate(
        pickFirst(
          talhao?.dataFim,
          talhao?.fimAtividade,
          talhao?.dataPrevistaFim,
          talhao?.dataMovimento,
          talhao?.data
        )
      ),
      variedadeId: variedadeId ?? 0,
      variedade:
        pickFirst(
          talhao?.variedade,
          talhao?.variedadeTalhao,
          talhao?.nomeVariedade
        ) ?? "",
      observacao:
        pickFirst(
          talhao?.observacao,
          talhao?.observacoes,
          talhao?.obs
        ) ?? "",
      statusMovimento:
        pickFirst(
          talhao?.statusMovimento,
          talhao?.status
        ) ?? 0,
      talhao:
        pickFirst(
          talhao?.talhao,
          talhao?.nome,
          talhao?.nomeTalhao,
          talhao?.descricao
        ) ?? `Talhao ${index + 1}`,
      talhaoId,
      qtdLimiteCertificada: normalizeNumber(
        pickFirst(talhao?.qtdLimiteCertificada, talhao?.limiteCertificado),
        0
      ),
      litrosPorPlanta: normalizeNumber(talhao?.litrosPorPlanta, 0),
      mediaHA: normalizeNumber(
        pickFirst(talhao?.mediaHA, talhao?.prodPorHa, talhao?.prodEstimadaHa),
        0
      ),
      tipoDesconto: normalizeTipoDesconto(pickFirst(talhao?.tipoDesconto)),
      valorDesconto: normalizeNumber(talhao?.valorDesconto, 0),
      qtdProducaoLiquido: normalizeNumber(
        pickFirst(
          talhao?.qtdProducaoLiquido,
          talhao?.producaoLiquida,
          talhao?.prodEstimadaLiquida,
          talhao?.prodEstimada
        ),
        0
      ),
      talhoes: talhao?.talhoes ?? null,
    };
  });
};

const resolveTalhaoId = (talhao) => {
  if (!talhao) return null;

  const raw = pickFirst(
    talhao?.talhaoId,
    talhao?.talhao?.id,
    talhao?.idTalhao,
    talhao?.idtalhao,
    talhao?.talhaoID,
    talhao?.codigoTalhao,
    talhao?.codigo,
    talhao?.id
  );

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

const normalizeSafraRecord = (safra) => {
  if (!safra) {
    return { record: safra, changed: false };
  }

  let changed = false;
  const record = { ...safra };

  let safraId = record.id;
  if (!isGuidLike(safraId)) {
    safraId = ensureId();
    changed = true;
  }
  safraId = String(safraId);

  if (record.id !== safraId) {
    record.id = safraId;
    changed = true;
  }

  if (record.previsaoSafraId !== safraId) {
    record.previsaoSafraId = safraId;
    changed = true;
  }

  if (record.codigoIntegracao !== safraId) {
    record.codigoIntegracao = safraId;
    changed = true;
  }

  if (Array.isArray(record.talhoes)) {
    const talhoesAtualizados = record.talhoes.map((talhao) => {
      if (!talhao) return talhao;

      let talhaoChanged = false;
      const atualizado = { ...talhao };

      if (!isGuidLike(atualizado.id)) {
        atualizado.id = ensureId();
        talhaoChanged = true;
      }

      const talhaoIdResolvido = resolveTalhaoId(atualizado);

      if (talhaoIdResolvido !== null && talhaoIdResolvido !== undefined) {
        if (atualizado.talhaoId !== talhaoIdResolvido) {
          atualizado.talhaoId = talhaoIdResolvido;
          talhaoChanged = true;
        }
      } else if (atualizado.talhaoId) {
        // Campo estava preenchido, mas nao conseguimos validar; mantem string
        const normalizedTalhaoId = String(atualizado.talhaoId);
        if (atualizado.talhaoId !== normalizedTalhaoId) {
          atualizado.talhaoId = normalizedTalhaoId;
          talhaoChanged = true;
        }
      }

      if (atualizado.previsaoSafraId !== safraId) {
        atualizado.previsaoSafraId = safraId;
        talhaoChanged = true;
      }

      return talhaoChanged ? atualizado : talhao;
    });

    if (
      talhoesAtualizados.some(
        (item, index) => item !== record.talhoes[index]
      )
    ) {
      record.talhoes = talhoesAtualizados;
      changed = true;
    }
  }

  return changed
    ? { record, changed: true }
    : { record: safra, changed: false };
};

const buildSafraPayload = (safra, context) => {
  const {
    userDetails,
    vendedorId,
    fallbackProdutor,
    fallbackPropriedade,
  } = context;

  const propriedadeFallback =
    fallbackPropriedade?.propriedade ?? fallbackPropriedade ?? null;

  const produtorInfo =
    safra?.produtorInfo ??
    safra?.produtorSelecionado ??
    fallbackProdutor ??
    null;

  const propriedadeInfo =
    safra?.propriedadeInfo ??
    safra?.propriedadeObj ??
    safra?.propriedadeSelecionada ??
    propriedadeFallback ??
    null;

  let previsaoId = pickFirst(
    safra?.codigoIntegracao,
    safra?.previsaoSafraId,
    safra?.id
  );
  if (!isGuidLike(previsaoId)) {
    previsaoId = ensureId();
  }
  previsaoId = String(previsaoId);

  const userId = pickFirst(
    userDetails?.id,
    userDetails?.userId,
    userDetails?.usuarioId
  );

  const nomeAgronomo =
    pickFirst(
      safra?.nomeAgronomo,
      userDetails?.nome,
      userDetails?.fullName,
      userDetails?.name
    ) ??
    [userDetails?.firstName, userDetails?.lastName]
      .filter(Boolean)
      .join(" ");

  const userName =
    pickFirst(
      safra?.userName,
      userDetails?.userName,
      userDetails?.username,
      userDetails?.email
    ) || nomeAgronomo || "";

  let statusPrevisao = pickFirst(
    safra?.statusPrevisao,
    safra?.statusCode
  );

  if (
    statusPrevisao === null ||
    statusPrevisao === undefined
  ) {
    if (typeof safra?.status === "number") {
      statusPrevisao = safra.status;
    } else if (typeof safra?.status === "string") {
      statusPrevisao =
        STATUS_PREVISAO_MAP[safra.status.trim().toLowerCase()] ?? 0;
    } else {
      statusPrevisao = 0;
    }
  }

  const statusPrevisaoNumero = normalizeNumber(statusPrevisao, 0);

  const produtorId = pickFirst(
    produtorInfo?.id,
    safra?.produtorId,
    safra?.produtor?.id,
    produtorInfo?.codigoCliente,
    produtorInfo?.parceiroId,
    produtorInfo?.codigoParceiro,
    produtorInfo?.codigoIntegracao,
    fallbackProdutor?.id,
    fallbackProdutor?.codigoCliente,
    fallbackProdutor?.parceiroId,
    fallbackProdutor?.codigoParceiro,
    fallbackProdutor?.codigoIntegracao
  );

  const parceiroNegocioIdSource =
    produtorId ??
    pickFirst(
      safra?.parceiroNegocioId,
      produtorInfo?.parceiroNegocioId,
      produtorInfo?.codigoParceiro,
      produtorInfo?.codigoIntegracao,
      fallbackProdutor?.parceiroNegocioId,
      fallbackProdutor?.codigoParceiro,
      fallbackProdutor?.codigoIntegracao
    );

  let parceiroNegocioId = 0;
  if (parceiroNegocioIdSource !== null && parceiroNegocioIdSource !== undefined) {
    const numericValue = Number(parceiroNegocioIdSource);
    parceiroNegocioId = Number.isFinite(numericValue)
      ? numericValue
      : String(parceiroNegocioIdSource).trim();
  }

  const nomeParceiroNegocio =
    pickFirst(
      safra?.nomeParceiroNegocio,
      safra?.produtor,
      produtorInfo?.nomeFantasia,
      produtorInfo?.razaoSocial,
      fallbackProdutor?.nomeFantasia,
      fallbackProdutor?.razaoSocial
    ) ?? "";

  const propriedadeIdRaw = pickFirst(
    safra?.propriedadeId,
    resolvePropertyId(propriedadeInfo),
    resolvePropertyId(propriedadeFallback)
  );
  const propriedadeId = normalizeNumber(propriedadeIdRaw, 0);

  const nomePropriedadeRaw =
    pickFirst(
      resolvePropertyLogradouro(propriedadeInfo),
      resolvePropertyLogradouro(propriedadeFallback),
      resolvePropertyLogradouro(safra?.propriedade),
      safra?.enderecoLogradouro
    );

  const nomePropriedade =
    nomePropriedadeRaw !== null && nomePropriedadeRaw !== undefined
      ? String(nomePropriedadeRaw).trim()
      : "";

  const detalhes = mapTalhoesToDetalhes(safra?.talhoes, previsaoId);

  const safraDescricao =
    pickFirst(safra?.safra, safra?.safraDescricao) ??
    "2025/2026";

  const agronomoId = normalizeNumber(
    pickFirst(
      safra?.agronomoId,
      vendedorId,
      userDetails?.vendedorId
    ),
    0
  );

  const safraId = normalizeNumber(
    pickFirst(safra?.safraId, safra?.safraCodigo),
    13
  );

  return {
    id: String(previsaoId),
    userId: userId ? String(userId) : null,
    dataMovimento: toIsoDate(
      pickFirst(safra?.dataMovimento, safra?.dataCadastro, safra?.data)
    ),
    userName,
    statusPrevisao: statusPrevisaoNumero,
    agronomoId,
    nomeAgronomo: nomeAgronomo ?? "",
    parceiroNegocioId,
    nomeParceiroNegocio,
    propriedadeId,
    nomePropriedade,
    safraId,
    safraDescricao,
    observacoesLancamento: safra?.observacoes ?? "",
    codigoIntegracao: previsaoId,
    fasePrevisaoSafraId: normalizeFasePrevisaoSafraId(
      pickFirst(safra?.fasePrevisaoSafraId, safra?.fasePrevisao, safra?.tipoSafra, safra?.faseId)
    ),
    detalhes,
  };
};

const markSafrasAsSynced = async (ids) => {
  if (!ids || ids.length === 0) return;
  const set = new Set(ids.map((id) => String(id)));

  let stored;
  try {
    stored = await AsyncStorage.getItem(SAFRAS_STORAGE_KEY);
  } catch (_error) {
    return;
  }

  if (!stored) return;

  let lista;
  try {
    lista = JSON.parse(stored);
  } catch (_error) {
    return;
  }

  if (!Array.isArray(lista)) return;

  const now = new Date().toISOString();
  const updated = lista.map((item) => {
    if (!item) return item;
    const itemId = String(item.id ?? "");
    if (!set.has(itemId)) return item;
    return {
      ...item,
      sincronizado: true,
      sincronizadoEm: now,
    };
  });

  try {
    await AsyncStorage.setItem(
      SAFRAS_STORAGE_KEY,
      JSON.stringify(updated)
    );
  } catch (_error) {
    // ignore persistence errors
  }
};

const syncSafrasWithBackend = async (safras, context) => {
  if (!Array.isArray(safras) || safras.length === 0) {
    return { syncedCount: 0, payloads: [] };
  }

  const syncedIds = [];
  const debugPayloads = [];

  try {
    for (const safra of safras) {
      const payload = buildSafraPayload(safra, context);
      debugPayloads.push(payload);

      console.log("[Sync] Safra local normalizada:", JSON.stringify(safra, null, 2));
      console.log(
        "[Sync] Enviando previsao de safra:",
        JSON.stringify(payload, null, 2)
      );
      try {
        await api.post(SAFRA_ENDPOINT, payload);
        syncedIds.push(payload.id);
      } catch (error) {
        const info = {
          payloadId: payload.id,
          status: error instanceof ApiError ? error.status : undefined,
          message: error?.message ?? "Erro desconhecido",
          details: error instanceof ApiError ? error.details : undefined,
        };
        console.error(
          "[Sync] Erro ao enviar previsao de safra:",
          JSON.stringify(info, null, 2)
        );
        throw error;
      }
    }
  } catch (error) {
    if (syncedIds.length > 0) {
      await markSafrasAsSynced(syncedIds);
    }
    throw error;
  }

  if (syncedIds.length > 0) {
    await markSafrasAsSynced(syncedIds);
  }

  return { syncedCount: syncedIds.length, payloads: debugPayloads };
};

const collectSafrasForSync = async () => {
  const stored = await AsyncStorage.getItem(SAFRAS_STORAGE_KEY);
  if (!stored) {
    return { pendingCount: 0, payloads: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(stored);
  } catch (_error) {
    return { pendingCount: 0, payloads: [] };
  }

  if (!Array.isArray(parsed)) {
    return { pendingCount: 0, payloads: [] };
  }

  let hasUpdates = false;
  const normalizados = parsed.map((item) => {
    if (!item || item.sincronizado === true) return item;
    const { record, changed } = normalizeSafraRecord(item);
    if (changed) hasUpdates = true;
    return record;
  });

  if (hasUpdates) {
    try {
      await AsyncStorage.setItem(
        SAFRAS_STORAGE_KEY,
        JSON.stringify(normalizados)
      );
    } catch (_error) {
      // Ignora falhas para não interromper o fluxo
    }
  }

  const pendentes = normalizados.filter(
    (item) => item && item.sincronizado !== true
  );
  return { pendingCount: pendentes.length, payloads: pendentes };
};

export async function syncAllData({ onStatus } = {}) {
  withStatus(onStatus, STATUS.CHECKING_CONNECTION);

  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected) {
    withStatus(onStatus, STATUS.OFFLINE);
    throw new SyncError(STATUS.OFFLINE, { code: "offline" });
  }

  const token = await AsyncStorage.getItem("@accessToken");
  const userDetailsStr = await AsyncStorage.getItem("@userDetails");

  if (!token || !userDetailsStr) {
    withStatus(onStatus, STATUS.AUTH_MISSING);
    throw new SyncError(STATUS.AUTH_MISSING, { code: "unauthenticated" });
  }

  let userDetails;
  try {
    userDetails = JSON.parse(userDetailsStr);
  } catch (error) {
    withStatus(onStatus, STATUS.AUTH_CORRUPTED);
    throw new SyncError(STATUS.AUTH_CORRUPTED, {
      code: "unauthenticated",
      cause: error,
    });
  }
  const vendedorId = userDetails?.vendedorId;

  if (!vendedorId) {
    withStatus(onStatus, STATUS.VENDOR_MISSING);
    throw new SyncError(STATUS.VENDOR_MISSING, { code: "vendor_missing" });
  }

  try {
    withStatus(onStatus, STATUS.PRODUCERS);
    const produtores = await api.get(
      `http://192.168.2.10:7081/api/v1/ParceiroNegocio/GetClientesVendedor/${vendedorId}`
    );
    await AsyncStorage.setItem("@produtores", JSON.stringify(produtores));

    withStatus(onStatus, STATUS.PROPERTIES);
    const propriedades = await api.get(
      "http://192.168.2.10:7077/api/propriedade-sem-cartao"
    );
    await AsyncStorage.setItem("@propriedadesSemCartao", JSON.stringify(propriedades));

    withStatus(onStatus, STATUS.TALHOES);
    const talhoes = await api.get(
      `http://192.168.2.10:7077/api/Talhao/tecnico/${vendedorId}`
    );
    await AsyncStorage.setItem("@talhoes", JSON.stringify(talhoes));

    withStatus(onStatus, STATUS.SAFRA_LIST);
    const safraList = await api.get(SAFRA_LIST_ENDPOINT);
    await AsyncStorage.setItem(
      SAFRA_LIST_STORAGE_KEY,
      JSON.stringify(safraList ?? [])
    );

    withStatus(onStatus, STATUS.SAFRA_PHASES);
    const safraPhases = await api.get(SAFRA_PHASES_ENDPOINT);
    await AsyncStorage.setItem(
      SAFRA_PHASES_STORAGE_KEY,
      JSON.stringify(safraPhases ?? [])
    );

    withStatus(onStatus, STATUS.LOCAL_SAFRAS);
    const {
      pendingCount: safraPendentesCount,
      payloads: safraPendentes,
    } = await collectSafrasForSync();

    let fallbackProdutor = null;
    let fallbackPropriedade = null;
    try {
      const storedProdutor = await AsyncStorage.getItem("@produtorSelecionado");
      if (storedProdutor) {
        fallbackProdutor = JSON.parse(storedProdutor);
      }
    } catch (_error) {
      fallbackProdutor = null;
    }

    try {
      const storedPropriedade = await AsyncStorage.getItem("@propriedadeSelecionada");
      if (storedPropriedade) {
        fallbackPropriedade = JSON.parse(storedPropriedade);
      }
    } catch (_error) {
      fallbackPropriedade = null;
    }

    let safraSincronizadas = 0;
    let safraDebugPayloads = [];
    if (safraPendentes.length > 0) {
      withStatus(onStatus, STATUS.SAFRAS_REMOTE);
      const { syncedCount, payloads } = await syncSafrasWithBackend(safraPendentes, {
        userDetails,
        vendedorId,
        fallbackProdutor,
        fallbackPropriedade,
      });
      safraSincronizadas = syncedCount;
      safraDebugPayloads = payloads;
    }

    const {
      pendingCount: safraPendentesRestantes,
    } =
      safraSincronizadas > 0
        ? await collectSafrasForSync()
        : { pendingCount: safraPendentesCount };

    const timestamp = new Date().toISOString();
    await AsyncStorage.setItem("@lastSyncAt", timestamp);

    withStatus(onStatus, STATUS.SUCCESS);

    return {
      produtoresCount: Array.isArray(produtores) ? produtores.length : null,
      propriedadesCount: Array.isArray(propriedades) ? propriedades.length : null,
      talhoesCount: Array.isArray(talhoes) ? talhoes.length : null,
      safraPendentesCount: safraPendentesRestantes,
      safraSincronizadas,
      safraDebugPayloads,
      timestamp,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        await handleSessionExpired(onStatus);
        throw new SyncError(STATUS.AUTH_EXPIRED, {
          code: "unauthenticated",
          details: error.details,
          cause: error,
        });
      }

      throw new SyncError(error.message, {
        code: "api_error",
        details: error.details,
        cause: error,
      });
    }

    if (error instanceof SyncError) throw error;

    throw new SyncError("Nao foi possivel sincronizar os dados.", {
      code: "unknown",
      cause: error,
    });
  }
}
