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


def test_previsao_de_risco_so_vale_fora_do_alerta():
    from app import risco
    assert risco.prever(_serie([40, 38, 35, 33])) is None  # já está em alerta: é diagnóstico, não previsão
    assert risco.prever(_serie([80, 78])) is None  # menos de 3 dias de histórico
    caindo = risco.prever(_serie([80, 74, 68, 62, 57, 56]))
    estavel = risco.prever(_serie([82, 84, 83, 85, 84, 86]))
    assert 0 <= estavel["probabilidade"] < caindo["probabilidade"] <= 1
    assert caindo["emRisco"] and not estavel["emRisco"]


def test_previsao_de_risco_supera_a_regra_simples():
    from app import risco
    m = risco.metricas()
    assert m["implantado"]["recall"] > m["baseline"]["recall"]
    assert m["implantado"]["precisao"] > m["baseline"]["precisao"]
    assert m["implantado"]["aucRoc"] > 0.85


def test_painel_marca_habilidades_em_risco(cliente, auth):
    alunos = cliente.get("/turmas/t1/alunos", headers=auth).json()
    marcadas = [h for a in alunos for h in a["habilidades"] if h["emRisco"]]
    assert all(h["status"] != "alerta" and h["iniciada"] for h in marcadas)


def test_kmeans_recupera_perfis_conhecidos():
    import random
    from app import grupos
    rng = random.Random(1)
    perfis = [[80] * 6, [45, 50, 80, 80, 80, 80], [80, 80, 80, 40, 45, 80]]
    pontos = [[v + rng.gauss(0, 5) for v in perfis[i % 3]] for i in range(24)]
    rotulos = grupos.kmeans(pontos, 3)
    # Cada perfil plantado cai inteiro num grupo só.
    for p in range(3):
        assert len({rotulos[i] for i in range(24) if i % 3 == p}) == 1
    assert grupos.silhueta(pontos, rotulos) > 0.5


def test_grupos_da_turma(cliente, auth):
    r = cliente.get("/turmas/t1/grupos", headers=auth).json()
    assert 2 <= r["k"] <= 4 and len(r["grupos"]) == r["k"]
    alunos = [a["id"] for g in r["grupos"] for a in g["alunos"]]
    assert len(alunos) == len(set(alunos)) == r["alunosConsiderados"]
    vazia = cliente.post("/turmas", json={"nome": "6º vazio", "ano": 6, "alunos": ["Um Aluno"]}, headers=auth).json()
    assert cliente.get(f"/turmas/{vazia['id']}/grupos", headers=auth).json()["grupos"] == []


def test_avaliacao_do_llm_publicada(cliente, auth):
    """O relatório de ml/avaliar_llm.py chega à página do modelo, com as duas colunas."""
    llm = cliente.get("/modelo", headers=auth).json()["llm"]
    assert llm["modelos"]["gerador"] and llm["modelos"]["revisor"]
    assert llm["modelos"]["gerador"] != llm["modelos"]["revisor"]
    for lado in ("autoRevisao", "outroModelo"):
        r = llm[lado]
        assert r["nCorretas"] > 0 and r["nErros"] > 0
        assert all(0 <= r[k] <= 1 for k in ("errosPegos", "boasRecusadas"))
