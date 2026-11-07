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
