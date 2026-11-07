"""Modelo de diagnóstico: explicação, coerência com as métricas e ciclo com dados reais."""
import pytest

from app import diagnostico
from app.dados import ALUNOS, STATUS_INICIAL


def _serie(valores):
    return [{"data": f"2026-10-{i + 1:02d}", "desempenho": v} for i, v in enumerate(valores)]


def test_modelo_carregado_e_probabilidades_somam_1():
    assert diagnostico.tem_modelo()
    probs = diagnostico.probabilidades(_serie([60, 62, 58, 61, 63]))
    assert set(probs) == {"ok", "atencao", "alerta"} and abs(sum(probs.values()) - 1) < 1e-6


def test_explicacao_coerente_com_a_classificacao():
    caindo = _serie([75, 70, 62, 55, 48, 44])
    e = diagnostico.explicar(caindo)
    assert e["status"] == diagnostico.classificar(caindo) == "alerta"
    assert e["confianca"] == max(e["probabilidades"].values())
    assert any("piorando" in m for m in e["motivos"])
    assert diagnostico.classificar(_serie([50, 58, 66, 74, 82, 88])) == "ok"


def test_metricas_do_treino_mostram_ganho_sobre_a_regra():
    m = diagnostico.metricas()
    assert m["implantado"]["f1Macro"] > m["baseline"]["f1Macro"]
    assert m["implantado"]["porClasse"]["atencao"]["recall"] > m["antesDoAjuste"]["porClasse"]["atencao"]["recall"]
    assert len(m["importancias"]) == 7


def test_status_da_demo_concordam_com_o_modelo():
    from app.seed import _historico_sintetico
    for a in ALUNOS:
        por_hab = {}
        for linha in _historico_sintetico(a):
            por_hab.setdefault(linha["habilidade_id"], []).append({"data": linha["data"], "desempenho": linha["desempenho"]})
        for hid, serie in por_hab.items():
            assert diagnostico.classificar(serie) == STATUS_INICIAL[a["id"]][hid]


def test_paridade_com_o_scikit_learn():
    """A inferência em Python puro tem de dar o mesmo resultado do scikit-learn (só roda onde
    as dependências de treino estão instaladas: pip install -r ml/requirements-treino.txt)."""
    pytest.importorskip("sklearn")
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split

    from ml.treinar import SEMENTE, carregar

    X, y = carregar()
    Xtr, _, ytr, _ = train_test_split(X, y, test_size=0.25, random_state=SEMENTE, stratify=y)
    parametros = diagnostico.metricas()["modelo"]["parametros"]
    rf = RandomForestClassifier(n_estimators=200, random_state=SEMENTE, n_jobs=-1, **parametros).fit(Xtr, ytr)
    modelo = diagnostico._carregar()

    def puro(x):
        soma = [0.0] * 3
        for arvore in modelo["arvores"]:
            for j, p in enumerate(diagnostico._prob_arvore(arvore, list(map(float, x)))):
                soma[j] += p
        return modelo["classes"][max(range(3), key=lambda j: soma[j])]

    amostra = X[:800]
    assert list(rf.predict(amostra)) == [puro(x) for x in amostra]


def test_avaliacao_do_professor_vira_dado_real(cliente, auth):
    diags = cliente.get("/alunos/a8/diagnostico", headers=auth).json()
    assert diags and all(d["modelo"] == "ml" and d["avaliacaoProfessor"] is None for d in diags)
    d = diags[0]
    outro = next(s for s in ["ok", "atencao", "alerta"] if s != d["status"])
    r = cliente.put(f"/alunos/a8/diagnostico/{d['habilidadeId']}", json={"status": outro}, headers=auth)
    assert r.status_code == 200 and r.json()["statusModelo"] == d["status"]
    assert cliente.get("/alunos/a8/diagnostico", headers=auth).json()[0]["avaliacaoProfessor"] == outro
    vivo = cliente.get("/modelo", headers=auth).json()["professores"]
    assert vivo["avaliacoes"] >= 1 and vivo["concordancia"] is not None
    assert cliente.put(f"/alunos/a8/diagnostico/{d['habilidadeId']}", json={"status": "talvez"}, headers=auth).status_code == 422
