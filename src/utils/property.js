const firstValid = (candidates = []) => {
  for (const value of candidates) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
};

export const resolvePropertyId = (propriedade) => {
  if (!propriedade) return null;

  const candidate = firstValid([
    propriedade.id,
    propriedade.ID,
    propriedade.propriedadeId,
    propriedade.idPropriedade,
    propriedade.codigoPropriedade,
    propriedade.codigoPropriedadeSemCartao,
    propriedade.codigo,
    propriedade.codigoEndereco,
    propriedade.idEndereco,
    propriedade.codigoFazenda,
    propriedade.fazendaId,
    propriedade.parceiroId,
    propriedade.codigoParceiro,
    propriedade.codigoIntegracao,
  ]);

  return candidate !== null ? String(candidate).trim() : null;
};

export const resolvePropertyName = (propriedade) => {
  if (!propriedade) return "";

  return (
    propriedade.enderecoLogradouro ||
    propriedade.descricao ||
    propriedade.nomePropriedade ||
    propriedade.nome ||
    propriedade.fantasia ||
    propriedade.razaoSocial ||
    ""
  );
};

export const resolvePropertyLogradouro = (propriedade) => {
  if (!propriedade || typeof propriedade !== "object") return "";

  const logradouro = propriedade.enderecoLogradouro;
  return logradouro ? String(logradouro).trim() : "";
};

