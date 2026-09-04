import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Publico } from './auth.guard';
import { UsuarioAtual } from './usuario-atual.decorator';

class CadastroDto {
  email!: string;
  senha!: string;
  /** O apelido do jogo — o que aparece na mesa, no chat e no ranking. */
  nome!: string;
  /** AAAA-MM-DD. Obrigatório: a conta só existe com 18 anos ou mais. */
  nascimento!: string;
  /** O nome de verdade. Fica guardado e não aparece pra outros jogadores. */
  nomeCompleto!: string;
  /** Tem que ser exatamente `true`. Sem aceite, não há cadastro. */
  aceitouTermos!: boolean;
}

class LoginDto {
  email!: string;
  senha!: string;
}

class LoginProvedorDto {
  provedor!: string;
  token!: string;
  nome?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Publico()
  @Post('cadastrar')
  cadastrar(@Body() body: CadastroDto) {
    if (!body?.email || !body?.senha || !body?.nome) {
      throw new BadRequestException('Informe e-mail, senha e apelido.');
    }
    return this.auth.registrarComSenha(body.email, body.senha, body.nome, {
      nascimento: body.nascimento,
      nomeCompleto: body.nomeCompleto,
      aceitouTermos: body.aceitouTermos,
    });
  }

  @Publico()
  @Post('entrar')
  entrar(@Body() body: LoginDto) {
    if (!body?.email || !body?.senha) {
      throw new BadRequestException('Informe email e senha.');
    }
    return this.auth.loginComSenha(body.email, body.senha);
  }

  /**
   * Quais logins sociais este servidor aceita agora. Vem vazio enquanto o Firebase não
   * estiver configurado — é o que permite a tela de login esconder os botões em vez de
   * mostrar um botão que sempre dá erro.
   */
  @Publico()
  @Get('provedores')
  provedores() {
    return { provedores: this.auth.provedoresDisponiveis() };
  }

  @Publico()
  @Post('entrar-com-provedor')
  entrarComProvedor(@Body() body: LoginProvedorDto) {
    if (!body?.provedor || !body?.token) {
      throw new BadRequestException('Informe provedor e token.');
    }
    return this.auth.loginComProvedor(body.provedor, body.token, body.nome);
  }

  /** Quem sou eu, segundo o token que mandei. Exige estar logado. */
  @Get('eu')
  async eu(@UsuarioAtual() userId: string) {
    return this.users.findById(userId);
  }
}
