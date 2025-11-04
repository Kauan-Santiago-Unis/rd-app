from pathlib import Path
text = Path('src/Screens/Safra/index.js').read_text(encoding='utf-8')
start = text.find('// ?? Quando abrir o segundo modal')
print('start', start)
end = text.find('// ?? Confirma propriedade', start)
print('end', end)
print(text[start:end])
