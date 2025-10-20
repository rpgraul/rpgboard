import os
import re

# Diretórios a serem ignorados na busca por arquivos
IGNORED_DIRS = {'.git', 'node_modules', 'venv', 'dist', 'build', '__pycache__'}

# Expressão regular para encontrar os blocos de conflito do Git
# Este padrão captura o bloco inteiro do conflito
CONFLICT_PATTERN = re.compile(
    r'<<<<<<< HEAD.*?=======.*?>>>>>>> [a-f0-9]{7,40}\n?',
    re.DOTALL
)

def resolver_bloco_mantendo_head(match):
    """
    Função que recebe um bloco de conflito e retorna apenas a versão 'HEAD' (local).
    """
    # Divide o bloco de conflito em duas partes usando '======='
    partes = match.group(0).split('=======')
    
    # A primeira parte contém a versão 'HEAD' com o marcador
    head_change_com_marcador = partes[0]
    
    # Remove o marcador inicial (ex: '<<<<<<< HEAD')
    head_change = head_change_com_marcador.replace('<<<<<<< HEAD', '')
    
    # Remove espaços em branco ou quebras de linha no início ou fim
    return head_change.strip() + '\n'

def processar_arquivo(caminho_arquivo):
    """
    Lê um arquivo, encontra conflitos e os resolve, salvando o arquivo de volta.
    """
    try:
        with open(caminho_arquivo, 'r', encoding='utf-8') as file:
            conteudo = file.read()

        # Verifica se há marcadores de conflito no arquivo
        if '<<<<<<<' in conteudo and '=======' in conteudo:
            print(f"Resolvendo conflitos em: {caminho_arquivo} (mantendo versão HEAD)")
            
            # Usa a expressão regular para encontrar e substituir todos os conflitos
            conteudo_resolvido = CONFLICT_PATTERN.sub(resolver_bloco_mantendo_head, conteudo)
            
            # Salva o arquivo com as resoluções
            with open(caminho_arquivo, 'w', encoding='utf-8') as file:
                file.write(conteudo_resolvido)
    except Exception as e:
        print(f"Erro ao processar o arquivo {caminho_arquivo}: {e}")

def main():
    """
    Função principal que percorre o diretório do projeto.
    """
    diretorio_atual = os.getcwd()
    print(f"Iniciando busca por conflitos de merge em: {diretorio_atual}")

    for raiz, dirs, arquivos in os.walk(diretorio_atual, topdown=True):
        # Remove os diretórios ignorados da busca
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        
        for nome_arquivo in arquivos:
            caminho_completo = os.path.join(raiz, nome_arquivo)
            processar_arquivo(caminho_completo)
    
    print("\nProcesso concluído!")
    print("Verifique os arquivos modificados e faça o commit se tudo estiver correto.")

if __name__ == "__main__":
    main()