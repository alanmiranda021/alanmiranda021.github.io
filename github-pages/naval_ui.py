"""Laboratório naval independente dos modos existentes."""
import hashlib
from dataclasses import asdict
import pandas as pd
import streamlit as st
from core.env import IN_BROWSER
from core.exp_artigo3 import NavalConfig, run_naval, validate_naval
from core.experiment_tracking import json_bytes
from core.report_pdf import naval_pdf


def render_benchmark():
    st.caption("Smoke técnico com dados artificiais; não ajusta transformadores ao upload e não produz conclusão científica.")
    if st.button("Medir um SAE artificial (sem usar o upload)"):
        import time
        import tracemalloc
        import numpy as np
        from core.sae import SparseAutoencoder
        tick = time.perf_counter()
        owned = not tracemalloc.is_tracing()
        if owned:
            tracemalloc.start()
        try:
            SparseAutoencoder(hidden_dim=3, maxiter=50).fit(np.random.default_rng(42).normal(size=(64, 8)))
            st.session_state["naval_benchmark"] = (time.perf_counter()-tick, tracemalloc.get_traced_memory()[1])
        finally:
            if owned:
                tracemalloc.stop()
    if "naval_benchmark" in st.session_state:
        elapsed, peak = st.session_state["naval_benchmark"]
        st.caption(f"Um SAE artificial 64×8, h=3, até 50 iterações: {elapsed:.3f} s; pico Python rastreado {peak} bytes (não é memória total do navegador).")


def render_naval(df, filename="tabela carregada", source_sha256=""):
    st.subheader("Laboratório — Artigo 3 (naval)")
    st.caption("Protocolo do Artigo 3 adaptado · resultados exploratórios · regressão do consumo de combustível")
    st.caption("Envie seu .mat no campo Dados da barra lateral. A tabela é processada nesta sessão; o arquivo não precisa existir no servidor. Confira o perfil e clique em Executar para gerar o PDF.")
    if "fuel_consumption" not in df or "ship_type" not in df:
        st.info("Envie a tabela naval com ship_type, route_id, distance, fuel_type, weather_conditions, engine_efficiency e fuel_consumption.")
        return
    st.info("N-FAST demonstrativo: células por ship_type, 3 dobras externas/internas, 1 repetição e SAE até 50 iterações. Não equivale ao E3 completo local de 16 células. O estudo é exploratório.")
    target = st.selectbox("Alvo naval", [c for c in ("fuel_consumption", "CO2_emissions") if c in df], key="naval_target")
    forbidden = "CO2_emissions" if target == "fuel_consumption" else "fuel_consumption"
    excluded = st.multiselect("Colunas excluídas", [c for c in df if c != target], default=[forbidden] if forbidden in df else [], key="naval_excluded_"+target)
    if forbidden not in excluded:
        st.error(f"Execução bloqueada: exclua {forbidden}, que revela o alvo.")
    mode = st.selectbox("Perfil naval", ["rapido", "smoke"] if IN_BROWSER else ["rapido", "mvp", "completo", "smoke"],
        format_func=lambda m: {"rapido":"N-FAST demonstrativo", "mvp":"MVP científico local", "completo":"Completo local", "smoke":"Smoke técnico"}[m], key="naval_mode")
    if mode == "smoke":
        render_benchmark()
        return
    use_efficiency = st.checkbox("Eficiência disponível antes da viagem", value=False, key="naval_efficiency")
    st.caption("Desmarque para previsão pré-viagem sem eficiência. Com a coluna habilitada e sem disponibilidade prévia, a análise é retrospectiva.")
    cells = st.multiselect("Colunas da célula (completo)", ["ship_type", "route_id"], default=["ship_type", "route_id"], disabled=mode == "rapido", key="naval_cells")
    fraction = st.number_input("Fração do aumento parcial", min_value=.01, max_value=1., value=.9, key="naval_fraction")
    hidden = st.multiselect("Grade de neurônios SAE", [3, 4, 5, 6], default=[3] if mode == "rapido" else [3, 4, 5, 6], key="naval_hidden_"+mode)
    gammas = st.multiselect("Grade gamma KPCA", [.01, .1, 1., 10., 100.], default=[.1] if mode == "rapido" else [.01, .1, 1., 10., 100.], key="naval_gamma_"+mode)
    components = st.multiselect("Grade de componentes KPCA", [5, 8, 11], default=[5] if mode == "rapido" else [5, 8, 11], key="naval_components_"+mode)
    repeats = st.number_input("Repetições externas (completo)", min_value=1, max_value=10, value=3, disabled=mode == "rapido", key="naval_repeats")
    models = st.multiselect("Modelos navais", ["SVR (RBF)", "Random Forest", "Rede Neural (MLP)", "KNN"], default=["SVR (RBF)", "Random Forest"], key="naval_models")
    seed = st.number_input("Semente naval", min_value=0, value=42, key="naval_seed")
    units = st.text_input("Unidades confirmadas", value="unidade não informada no dataset", key="naval_units")
    from core.exp_artigo3 import SCENARIOS
    scenarios = st.multiselect("Experimentos navais", [s for s in SCENARIOS if mode == "completo" or s != "E3-orig"],
        default=["E1", "E3", "DIST"] if mode == "rapido" else [s for s in SCENARIOS if s != "E3-orig"], key="naval_scenarios_"+mode)
    sensitivity = st.checkbox("Sensibilidade por rota e tipo (somente local completo)", disabled=mode == "rapido", key="naval_sensitivity") if mode == "completo" else False
    draws = st.number_input("Sorteios por busca", min_value=1, max_value=8 if mode == "rapido" else 20, value=2 if mode == "rapido" else 20, key="naval_draws_"+mode)
    budget = st.number_input("Orçamento máximo (segundos)", min_value=1., max_value=86400., value=300. if mode == "rapido" else 7200., key="naval_budget_"+mode)
    with st.expander("Detalhes do SAE e benchmark técnico"):
        beta = st.number_input("Beta (suposição)", min_value=0., value=1., key="naval_beta")
        rho = st.number_input("Rho (suposição)", min_value=.001, max_value=.999, value=.05, key="naval_rho")
        alpha = st.number_input("Lambda L2", min_value=0., value=.01, key="naval_alpha")
        noise = st.multiselect("Escalas de ruído s", [.25, .5, 1.], default=[.25, .5, 1.], key="naval_noise")
        render_benchmark()
    cfg = NavalConfig(target=target, excluded=tuple(excluded), cell_columns=tuple(cells), mode=mode,
        partial_fraction=float(fraction), hidden_grid=tuple(hidden), gamma_grid=tuple(gammas),
        components_grid=tuple(components), repeats=int(repeats), seed=int(seed), models=tuple(models),
        units=units, filename=filename, source_sha256=source_sha256, use_efficiency=use_efficiency,
        scenarios=tuple(scenarios), sensitivity=sensitivity, draws=int(draws), budget_seconds=float(budget),
        beta=float(beta), rho=float(rho), alpha=float(alpha), noise_grid=tuple(noise))
    jobs = (3 if mode == "rapido" else 5*int(repeats)) * sum(2 if s == "DIST" else len(models) for s in scenarios)
    st.caption(f"Planejamento: {jobs} avaliações externas; até {jobs*(int(draws)*(3 if mode == 'rapido' else 5)+1)} ajustes de modelos, além dos SAEs. O cache pode reduzir trabalho. O orçamento é conferido entre ajustes; um ajuste individual pode ultrapassá-lo.")
    st.caption("Referência medida na versão anterior: 194 s para 80 linhas artificiais, SVR e oito cenários (perfil diferente). Não é previsão de duração para sua base. Use o orçamento e o benchmark desta máquina.")
    if st.button("Cancelar execução naval"):
        st.session_state.pop("naval_result", None)
        st.session_state.pop("naval_pdf", None)
        st.info("Interrupção solicitada por nova execução da interface. Resultados anteriores removidos.")
    signature = hashlib.sha256(pd.util.hash_pandas_object(df, index=True).values.tobytes()+json_bytes(asdict(cfg))).hexdigest()
    if st.session_state.get("naval_signature") != signature:
        st.session_state.pop("naval_result", None)
        st.session_state.pop("naval_pdf", None)
        st.session_state["naval_signature"] = signature
    valid = True
    try:
        validate_naval(df, cfg.effective())
    except ValueError as exc:
        valid = False
        st.error(str(exc))
    if st.button("Executar protocolo naval e gerar PDF", disabled=not valid, type="primary"):
        st.session_state.pop("naval_result", None)
        st.session_state.pop("naval_pdf", None)
        bar = st.progress(0., text="Preparando partições navais")
        try:
            result = run_naval(df, cfg, progress=lambda p, text: bar.progress(p*.95, text=text))
            st.session_state["naval_result"] = result
            st.session_state["naval_pdf"] = naval_pdf(result)
            bar.progress(1., text="PDF concluído")
        except Exception as exc:
            st.error(f"Execução naval: {exc}")
    if "naval_result" in st.session_state:
        result = st.session_state["naval_result"]
        st.success(f"{result.get('profile', mode)}: {result.get('status', 'concluído')} em {result['seconds']:.1f} s")
        st.dataframe(pd.DataFrame(result["ranking"]))
        st.dataframe(pd.DataFrame(result["comparisons"]))
        if result["failures"]:
            if result.get('status') == 'concluído com candidatos rejeitados':
                st.info("Candidatos internos foram rejeitados, mas os experimentos e o teste final concluíram. Os motivos estão no PDF.")
            else:
                st.warning("Ocorreram falhas parciais. Consulte o PDF antes de interpretar o ranking.")
        if "naval_pdf" in st.session_state:
            st.download_button("Baixar relatório científico completo (PDF)", st.session_state["naval_pdf"], "protocolo_artigo3_naval.pdf", "application/pdf")
