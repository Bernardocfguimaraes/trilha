"""Conteúdo: catálogos válidos e questões bem formadas em todos os anos."""
from collections import Counter

from app import catalogo
from app.dados import ANOS_COM_CONTEUDO, BANCO, HAB_POR_ID, disciplinas_com_conteudo


def test_ids_unicos_e_habilidades_existentes():
    assert len({p["id"] for p in BANCO}) == len(BANCO)
    assert all(p["habilidadeId"] in HAB_POR_ID for p in BANCO)


def test_questoes_bem_formadas():
    for p in BANCO:
        assert len(p["opcoes"]) >= 3, p["id"]
        assert len({o.strip().lower() for o in p["opcoes"]}) == len(p["opcoes"]), p["id"]
        assert 0 <= p["certa"] < len(p["opcoes"]), p["id"]
        assert p["nivel"] in ("facil", "medio", "dificil"), p["id"]
        assert p["enunciado"].strip(), p["id"]


def test_codigos_bncc_sao_oficiais_e_do_ano_certo():
    oficial = catalogo.oficial()
    for h in HAB_POR_ID.values():
        if h["codigoBncc"]:
            assert h["codigoBncc"] in oficial
            assert catalogo.cobre_ano(h["codigoBncc"], h["ano"]), h["codigoBncc"]


def test_anos_com_conteudo_tem_as_seis_materias_e_tres_niveis():
    assert ANOS_COM_CONTEUDO == [4, 6, 8]
    for ano in ANOS_COM_CONTEUDO:
        assert set(disciplinas_com_conteudo(ano)) == {"por", "mat", "geo", "cie", "his", "ing"}
    niveis = Counter(p["nivel"] for p in BANCO)
    assert all(niveis[n] > 50 for n in ("facil", "medio", "dificil"))


def _por_arquivo():
    import glob
    import json
    import os
    for arq in sorted(glob.glob(os.path.join(os.path.dirname(catalogo.__file__), "bncc", "perguntas", "*.json"))):
        with open(arq, encoding="utf-8") as f:
            yield os.path.basename(arq), json.load(f)["perguntas"]


def test_resposta_certa_nao_se_entrega_pelo_tamanho():
    """Ninguém deve acertar só escolhendo a alternativa mais longa. Ao acaso, a certa é a
    mais longa em ~25% das questões; aceitamos até 35% por arquivo e nenhum caso flagrante
    (a certa bem mais longa que todas as outras)."""
    for nome, qs in _por_arquivo():
        mais_longa = 0
        for q in qs:
            tam = sorted((len(o) for o in q["opcoes"]), reverse=True)
            certa = len(q["opcoes"][q["certa"]])
            if certa == tam[0] and tam[0] > tam[1]:
                mais_longa += 1
                assert not (certa >= 1.3 * tam[1] and certa - tam[1] >= 6), f"{nome} {q['id']}: certa bem mais longa"
        assert mais_longa / len(qs) <= 0.35, f"{nome}: certa é a mais longa em {mais_longa}/{len(qs)}"


def test_enunciado_e_pergunta_completa():
    """Enunciado terminando em "…" parece cortado na tela do aluno."""
    for p in BANCO:
        assert not p["enunciado"].rstrip().endswith(("…", "...")), p["id"]


def test_posicao_da_resposta_sorteada():
    """A ordem das opções é sorteada na carga: nenhuma posição concentra as respostas."""
    posicoes = Counter(p["certa"] for p in catalogo.perguntas_geradas())
    total = sum(posicoes.values())
    assert all(0.18 <= posicoes[i] / total <= 0.32 for i in range(4)), posicoes
