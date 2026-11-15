import json

from app import exercicios

QUESTAO = {
    "enunciado": "Qual fração é equivalente a 1/2?",
    "opcoes": ["2/4", "1/3", "3/4", "2/3"],
    "indiceCorreta": 0,
    "explicacao": "2/4 é a metade.",
}


def test_checador_recusa_resposta_que_se_entrega_pelo_tamanho():
    entregue = {**QUESTAO, "opcoes": ["A metade de um inteiro dividido em partes iguais", "Um terço", "Três quartos", "Dois terços"]}
    assert not exercicios._valido(entregue)
    assert exercicios._valido(QUESTAO)


def _simular_llm(monkeypatch, aprova: bool):
    chamadas = {"gerador": 0, "revisor": 0}

    def gerar(sistema, mensagens, temperatura=0.4, max_tokens=500, papel="geral"):
        if papel == "revisor":
            chamadas["revisor"] += 1
            return json.dumps({"analise": "ok", "resposta": 0 if aprova else 1, "unicaCorreta": aprova,
                               "conteudoCorreto": aprova, "avaliaHabilidade": True, "problema": ""})
        chamadas["gerador"] += 1
        return json.dumps(QUESTAO)

    monkeypatch.setattr(exercicios.llm, "disponivel", lambda: True)
    monkeypatch.setattr(exercicios.llm, "gerar", gerar)
    return chamadas


def test_exercicio_do_painel_passa_pelo_revisor(cliente, auth, monkeypatch):
    chamadas = _simular_llm(monkeypatch, aprova=True)
    r = cliente.post("/exercicios/gerar", json={"habilidadeId": "EF05MA04", "nivel": "facil"}, headers=auth)
    assert r.status_code == 200 and r.json()["origem"] == "ia"
    assert chamadas["revisor"] >= 1


def test_revisor_recusando_cai_no_banco_curado(cliente, auth, monkeypatch):
    chamadas = _simular_llm(monkeypatch, aprova=False)
    r = cliente.post("/exercicios/gerar", json={"habilidadeId": "EF05MA04", "nivel": "facil"}, headers=auth)
    assert r.status_code == 200 and r.json()["origem"] == "banco"
    assert chamadas["gerador"] == 3 and chamadas["revisor"] == 3


def test_conversa_envia_habilidades_por_aluno_e_temperatura_baixa(monkeypatch):
    from app import chat

    retrato = {
        "turma": "4º ano B",
        "habilidades": [
            {"id": "f", "nome": "Frações simples", "disciplina": "Matemática", "alerta": ["Bruno F."], "atencao": ["Ana S."]},
            {"id": "m", "nome": "Multiplicação", "disciplina": "Matemática", "alerta": [], "atencao": ["Bruno F."]},
        ],
        "evolucao": [],
        "semAtividade": [],
    }
    linhas = chat._por_aluno(retrato)
    assert "- Ana S.: atenção em Frações simples (Matemática)" in linhas
    assert "- Bruno F.: alerta em Frações simples (Matemática); atenção em Multiplicação (Matemática)" in linhas
    enviado = {}

    def gerar(sistema, mensagens, temperatura=0.4, max_tokens=500, papel="geral"):
        enviado.update(sistema=sistema, temperatura=temperatura)
        return "ok"

    monkeypatch.setattr(chat.llm, "disponivel", lambda: True)
    monkeypatch.setattr(chat.llm, "gerar", gerar)
    assert chat.responder_llm("Como está a Ana?", retrato) == "ok"
    assert "Por aluno" in enviado["sistema"] and "- Ana S.: atenção em Frações simples (Matemática)" in enviado["sistema"]
    assert enviado["temperatura"] <= 0.2
