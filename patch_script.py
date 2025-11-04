from pathlib import Path
text = Path("src/Screens/Safra/index.js").read_text(encoding="utf-8")
start = text.find("// ?? Quando abrir o segundo modal, busca propriedades do produtor salvo")
print("start", start)
end_marker = "  }, [showPropriedadeModal]);\n\n\n"
end = text.find(end_marker, start)
print("end", end)
if start == -1 or end == -1:
    raise SystemExit("block not found")
end += len(end_marker)
new_block = "  // ?? Quando abrir o segundo modal, busca propriedades do produtor salvo\n  useEffect(() => {\n    if (!showPropriedadeModal) return;\n\n    const carregarPropriedades = async () => {\n      try {\n        let produtor = produtorSelecionado;\n\n        if (!produtor) {\n          const storedProdutor = await AsyncStorage.getItem(\"@produtorSelecionado\");\n          if (storedProdutor) {\n            produtor = JSON.parse(storedProdutor);\n          }\n        }\n\n        if (!produtor) {\n          setPropriedades([]);\n          return;\n        }\n\n        console.log(\"?? Produtor selecionado:\", produtor?.id);\n\n        const enderecosBrutos = Array.isArray(produtor?.enderecos)\n          ? produtor.enderecos\n          : [];\n\n        const enderecos = enderecosBrutos.map((item, index) => ({\n          ...item,\n          _localId: index,\n          descricaoFormatada:\n            item?.descricao ||\n            item?.nomePropriedade ||\n            item?.nomeFazenda ||\n            item?.enderecoLogradouro ||\n            \"Sem descricao\",\n        }));\n\n        console.log(\"[Safra] Propriedades (com cartao) do produtor:\",\n          enderecos.map((item) => ({\n            id:\n              item?.id ??\n              item?.codigo ??\n              item?.codigoIntegracao ??\n              item?._localId ??\n              null,\n            descricao: item?.descricaoFormatada,\n          }))\n        );\n        console.log(\"[Safra] Total de propriedades (com cartao):\", enderecos.length);\n\n        setPropriedades(enderecos);\n        setPropriedadeSelecionada(null);\n      } catch (error) {\n        console.error(\"? Erro ao carregar propriedades:\", error);\n        setPropriedades([]);\n      }\n    };\n\n    carregarPropriedades();\n  }, [showPropriedadeModal, produtorSelecionado]);\n\n\n"
text = text[:start] + new_block + text[end:]
Path("src/Screens/Safra/index.js").write_text(text, encoding="utf-8")
