0059BBC0  push    ebp
0059BBC1  mov     ebp, esp
0059BBC3  and     esp, 0FFFFFFF8h
0059BBC6  sub     esp, 84h
0059BBCC  mov     eax, [ebp+arg_0]
0059BBCF  push    ebx
0059BBD0  push    esi
0059BBD1  cmp     eax, 190h
0059BBD6  push    edi
0059BBD7  mov     [esp+90h+var_80], ecx
0059BBDB  jg      short loc_59BBE5
0059BBDD  mov     eax, 190h
0059BBE2  mov     [ebp+arg_0], eax
0059BBE5  lea     edi, ds:2[eax*8]
0059BBEC  cmp     edi, 64h ; 'd'
0059BBEF  jg      short loc_59BBF6
0059BBF1  mov     edi, 64h ; 'd'
0059BBF6  lea     eax, ds:0[edi*8]
0059BBFD  mov     [esp+90h+var_54], edi
0059BC01  push    eax; Size
0059BC02  call    ??2@YAPAXI@Z; operator new(uint)
0059BC07  xor     ebx, ebx
0059BC09  add     esp, 4
0059BC0C  cmp     eax, ebx
0059BC0E  jz      short loc_59BC1D
0059BC10  lea     ecx, [edi-1]
0059BC13  mov     [esp+90h+Block], eax
0059BC17  mov     dword ptr [esp+90h+var_30], ecx
0059BC1B  jmp     short loc_59BC21
0059BC1D  mov     [esp+90h+Block], ebx
0059BC21  push    14h; Size
0059BC23  call    ??2@YAPAXI@Z; operator new(uint)
0059BC28  mov     esi, eax
0059BC2A  add     esp, 4
0059BC2D  cmp     esi, ebx
0059BC2F  jz      short loc_59BC6D
0059BC31  lea     edx, ds:4[edi*4]
0059BC38  mov     [esi+0Ch], ebx
0059BC3B  push    edx; Size
0059BC3C  mov     dword ptr [esi+10h], 0FFFFFFFFh
0059BC43  mov     [esi], ebx
0059BC45  mov     [esi+4], edi
0059BC48  call    ??2@YAPAXI@Z; operator new(uint)
0059BC4D  mov     ecx, [esi+4]
0059BC50  mov     [esi+8], eax
0059BC53  add     esp, 4
0059BC56  xor     eax, eax
0059BC58  cmp     ecx, ebx
0059BC5A  jl      short loc_59BC6F
0059BC5C  mov     ecx, [esi+8]
0059BC5F  inc     eax
0059BC60  mov     [ecx+eax*4-4], ebx
0059BC64  mov     ecx, [esi+4]
0059BC67  cmp     eax, ecx
0059BC69  jle     short loc_59BC5C
0059BC6B  jmp     short loc_59BC6F
0059BC6D  xor     esi, esi
0059BC6F  mov     ecx, [ebp+arg_8]
0059BC72  mov     eax, [ecx]
0059BC74  cmp     eax, ebx
0059BC76  jnz     loc_59BDEC
0059BC7C  cmp     [ecx+4], ebx
0059BC7F  jnz     loc_59BDEC
0059BC85  mov     [esp+90h+var_6C], ebx
0059BC89  mov     edx, dword_87F8DC
0059BC8F  mov     dword ptr [esp+90h+var_20+4], 0
0059BC97  lea     ebx, [edx-1]
0059BC9A  lea     eax, [ebx+1]
0059BC9D  mov     dword ptr [esp+90h+var_20], eax
0059BCA1  fild    [esp+90h+var_20]
0059BCA5  fstp    [esp+90h+var_8]
0059BCAC  mov     ecx, offset unk_ABE890
0059BCB1  call    sub_65C780
0059BCB6  mov     dword ptr [esp+90h+var_28], eax
0059BCBA  mov     dword ptr [esp+90h+var_28+4], 0
0059BCC2  fild    [esp+90h+var_28]
0059BCC6  fmul    [esp+90h+var_8]
0059BCCD  fmul    ds:dbl_7ED898
0059BCD3  call    sub_7C5F00
0059BCD8  mov     edi, eax
0059BCDA  cmp     edi, ebx
0059BCDC  ja      short loc_59BCAC
0059BCDE  mov     ecx, dword_87F8E0
0059BCE4  mov     dword ptr [esp+90h+var_48+4], 0
0059BCEC  lea     ebx, [ecx-1]
0059BCEF  lea     edx, [ebx+1]
0059BCF2  mov     dword ptr [esp+90h+var_48], edx
0059BCF6  fild    [esp+90h+var_48]
0059BCFA  fstp    [esp+90h+var_8]
0059BD01  mov     ecx, offset unk_ABE890
0059BD06  call    sub_65C780
0059BD0B  mov     dword ptr [esp+90h+var_50], eax
0059BD0F  mov     dword ptr [esp+90h+var_50+4], 0
0059BD17  fild    [esp+90h+var_50]
0059BD1B  fmul    [esp+90h+var_8]
0059BD22  fmul    ds:dbl_7ED898
0059BD28  call    sub_7C5F00
0059BD2D  cmp     eax, ebx
0059BD2F  ja      short loc_59BD01
0059BD31  mov     dx, word ptr dword_87F8DC
0059BD38  mov     ecx, edi
0059BD3A  neg     ecx
0059BD3C  mov     word ptr [esp+90h+var_40+2], cx
0059BD41  mov     word ptr [esp+90h+var_36], dx
0059BD46  mov     ecx, [esp+90h+var_36]
0059BD4A  mov     edx, [esp+90h+var_40+2]
0059BD4E  inc     edi
0059BD4F  add     ecx, edx
0059BD51  mov     word ptr [esp+90h+var_30], di
0059BD56  mov     word ptr [esp+90h+var_30+2], cx
0059BD5B  mov     ecx, dword ptr [esp+90h+var_30]
0059BD5F  mov     edx, dword ptr [esp+90h+var_30+2]
0059BD63  add     ecx, eax
0059BD65  add     eax, edx
0059BD67  mov     word ptr [esp+90h+var_5C], cx
0059BD6C  mov     word ptr [esp+90h+var_5C+2], ax
0059BD71  mov     edx, [esp+90h+var_5C]
0059BD75  mov     [esp+90h+var_7C], edx
0059BD79  mov     edx, [esp+90h+var_6C]
0059BD7D  inc     edx
0059BD7E  cmp     edx, 0C8h
0059BD84  mov     [esp+90h+var_6C], edx
0059BD88  jge     short loc_59BDE1
0059BD8A  mov     edx, dword_ABED10
0059BD90  test    edx, edx
0059BD92  jz      loc_59BC89
0059BD98  movsx   eax, ax
0059BD9B  imul    eax, dword_89C2DC
0059BDA2  movsx   ecx, cx
0059BDA5  add     eax, ecx
0059BDA7  lea     eax, [eax+eax*4]
0059BDAA  shl     eax, 4
0059BDAD  mov     ecx, [eax+edx+38h]
0059BDB1  test    ecx, ecx
0059BDB3  jnz     loc_59BC89
0059BDB9  lea     ecx, [esp+90h+var_7C]
0059BDBD  push    ecx
0059BDBE  mov     ecx, offset stru_87F7E8
0059BDC3  call    sub_5657A0
0059BDC8  mov     ecx, eax
0059BDCA  call    sub_4865D0
0059BDCF  test    al, al
0059BDD1  jz      loc_59BC89
0059BDD7  cmp     [esp+90h+var_6C], 0C8h
0059BDDF  jl      short loc_59BE02
0059BDE1  xor     eax, eax
0059BDE3  pop     edi
0059BDE4  pop     esi
0059BDE5  pop     ebx
0059BDE6  mov     esp, ebp
0059BDE8  pop     ebp
0059BDE9  retn    20h ; ' '
0059BDEC  mov     dx, [ecx+4]
0059BDF0  mov     word ptr [esp+90h+var_5C], ax
0059BDF5  mov     word ptr [esp+90h+var_5C+2], dx
0059BDFA  mov     eax, [esp+90h+var_5C]
0059BDFE  mov     [esp+90h+var_7C], eax
0059BE02  mov     eax, [ebp+arg_4]
0059BE05  mov     edx, dword_ABE2F0
0059BE0B  mov     [esp+90h+var_60], 0
0059BE13  mov     [esp+90h+var_64], 0
0059BE1B  mov     ecx, [eax]
0059BE1D  cmp     ecx, edx
0059BE1F  jnz     short loc_59BE48
0059BE21  mov     edx, [eax+4]
0059BE24  mov     ecx, dword_ABE2F4
0059BE2A  cmp     edx, ecx
0059BE2C  jnz     short loc_59BE48
0059BE2E  mov     ecx, [eax+8]
0059BE31  mov     edx, dword_ABE2F8
0059BE37  cmp     ecx, edx
0059BE39  jnz     short loc_59BE48
0059BE3B  mov     edx, [eax+0Ch]
0059BE3E  mov     ecx, dword_ABE2FC
0059BE44  cmp     edx, ecx
0059BE46  jz      short loc_59BE90
0059BE48  mov     ecx, [eax+8]
0059BE4B  mov     eax, [eax+0Ch]
0059BE4E  cmp     ecx, eax
0059BE50  mov     [esp+90h+var_6C], ecx
0059BE54  mov     [esp+90h+var_5C], eax
0059BE58  jle     short loc_59BE76
0059BE5A  fild    [esp+90h+var_6C]
0059BE5E  mov     [esp+90h+var_60], 3F800000h
0059BE66  fidiv   [esp+90h+var_5C]
0059BE6A  fmul    ds:dbl_7E5190
0059BE70  fstp    [esp+90h+var_64]
0059BE74  jmp     short loc_59BE90
0059BE76  fild    [esp+90h+var_5C]
0059BE7A  mov     [esp+90h+var_64], 3F800000h
0059BE82  fidiv   [esp+90h+var_6C]
0059BE86  fmul    ds:dbl_7E5190
0059BE8C  fstp    [esp+90h+var_60]
0059BE90  movsx   eax, word ptr [esp+90h+var_7C]
0059BE95  movsx   ecx, word ptr [esp+90h+var_7C+2]
0059BE9A  mov     dword ptr [esp+90h+var_48], eax
0059BE9E  mov     edx, [esi]
0059BEA0  fild    dword ptr [esp+90h+var_48]
0059BEA4  mov     dword ptr [esp+90h+var_48], ecx
0059BEA8  xor     ecx, ecx
0059BEAA  xor     eax, eax
0059BEAC  cmp     edx, ecx
0059BEAE  fstp    [esp+90h+var_28]
0059BEB2  fild    dword ptr [esp+90h+var_48]
0059BEB6  mov     [esp+90h+var_74], ecx
0059BEBA  fstp    [esp+90h+var_20]
0059BEBE  jl      short loc_59BECE
0059BEC0  mov     edx, [esi+8]
0059BEC3  inc     eax
0059BEC4  mov     [edx+eax*4-4], ecx
0059BEC8  mov     edx, [esi]
0059BECA  cmp     eax, edx
0059BECC  jle     short loc_59BEC0
0059BECE  mov     edi, [esp+90h+Block]
0059BED2  mov     [esi], ecx
0059BED4  mov     eax, [esp+90h+var_7C]
0059BED8  mov     [esp+90h+var_70], 1
0059BEE0  mov     [edi], eax
0059BEE2  mov     [edi+4], ecx
0059BEE5  movsx   eax, word ptr [esp+90h+var_7C+2]
0059BEEA  imul    eax, dword_89C2DC
0059BEF1  movsx   ecx, word ptr [esp+90h+var_7C]
0059BEF6  add     eax, ecx
0059BEF8  lea     edx, [eax+eax*4]
0059BEFB  mov     eax, [esp+90h+var_80]
0059BEFF  shl     edx, 4
0059BF02  mov     ecx, [eax+308h]
0059BF08  mov     eax, dword_ABED10
0059BF0D  mov     [edx+eax+3Ch], ecx
0059BF11  mov     ecx, [esi]
0059BF13  mov     eax, [edi+4]
0059BF16  inc     ecx
0059BF17  mov     edx, ecx
0059BF19  mov     dword ptr [esp+90h+var_48], eax
0059BF1D  mov     eax, [esi+4]
0059BF20  shr     edx, 1
0059BF22  cmp     ecx, eax
0059BF24  jnb     short loc_59BF6B
0059BF26  cmp     ecx, 1
0059BF29  jbe     short loc_59BF4E
0059BF2B  mov     ebx, [esi+8]
0059BF2E  mov     eax, [ebx+edx*4]
0059BF31  fld     dword ptr [eax+4]
0059BF34  fcomp   dword ptr [esp+90h+var_48]
0059BF38  fnstsw  ax
0059BF3A  test    ah, 41h
0059BF3D  jnz     short loc_59BF4E
0059BF3F  mov     eax, [ebx+edx*4]
0059BF42  mov     [ebx+ecx*4], eax
0059BF45  mov     ecx, edx
0059BF47  shr     edx, 1
0059BF49  cmp     ecx, 1
0059BF4C  ja      short loc_59BF2B
0059BF4E  mov     edx, [esi+8]
0059BF51  mov     [edx+ecx*4], edi
0059BF54  mov     ecx, [esi]
0059BF56  mov     eax, [esi+0Ch]
0059BF59  inc     ecx
0059BF5A  cmp     edi, eax
0059BF5C  mov     [esi], ecx
0059BF5E  jbe     short loc_59BF63
0059BF60  mov     [esi+0Ch], edi
0059BF63  cmp     edi, [esi+10h]
0059BF66  jnb     short loc_59BF6B
0059BF68  mov     [esi+10h], edi
0059BF6B  mov     ecx, [esi]
0059BF6D  test    ecx, ecx
0059BF6F  jnz     short loc_59BF75
0059BF71  xor     edi, edi
0059BF73  jmp     short loc_59BF9B
0059BF75  mov     eax, [esi+8]
0059BF78  push    1
0059BF7A  mov     ecx, [eax+ecx*4]
0059BF7D  mov     edi, [eax+4]
0059BF80  mov     [eax+4], ecx
0059BF83  mov     edx, [esi]
0059BF85  mov     eax, [esi+8]
0059BF88  mov     dword ptr [eax+edx*4], 0
0059BF8F  mov     ecx, [esi]
0059BF91  dec     ecx
0059BF92  mov     [esi], ecx
0059BF94  mov     ecx, esi
0059BF96  call    sub_5AD870
0059BF9B  mov     eax, [ebp+arg_4]
0059BF9E  mov     [esp+90h+var_6C], edi
0059BFA2  fild    dword ptr [eax+8]
0059BFA5  fmul    ds:dbl_7E1738
0059BFAB  fld     st
0059BFAD  fmul    st, st(1)
0059BFAF  fdivr   ds:dbl_7E1718
0059BFB5  fstp    [esp+90h+var_10]
0059BFBC  fstp    st
0059BFBE  fild    dword ptr [eax+0Ch]
0059BFC1  mov     eax, [ebp+arg_0]
0059BFC4  test    eax, eax
0059BFC6  fmul    ds:dbl_7E1738
0059BFCC  fld     st
0059BFCE  fmul    st, st(1)
0059BFD0  fdivr   ds:dbl_7E1718
0059BFD6  fstp    [esp+90h+var_18]
0059BFDA  fstp    st
0059BFDC  jle     loc_59C332
0059BFE2  test    edi, edi
0059BFE4  jz      loc_59C332
0059BFEA  mov     ecx, dword_ABED10
0059BFF0  test    ecx, ecx
0059BFF2  jz      short loc_59C018
0059BFF4  movsx   eax, word ptr [edi+2]
0059BFF8  imul    eax, dword_89C2DC
0059BFFF  movsx   edx, word ptr [edi]
0059C002  add     eax, edx
0059C004  mov     edx, [esp+90h+var_80]
0059C008  mov     edx, [edx+308h]
0059C00E  lea     eax, [eax+eax*4]
0059C011  shl     eax, 4
0059C014  mov     [eax+ecx+38h], edx
0059C018  push    edi
0059C019  mov     ecx, offset stru_87F7E8
0059C01E  call    sub_5657A0
0059C023  mov     ecx, [esp+90h+Block]
0059C027  mov     edx, [esp+90h+var_70]
0059C02B  mov     dword ptr [eax+38h], 0
0059C032  mov     ebx, dword_ABED04
0059C038  xor     eax, eax
0059C03A  lea     ecx, [ecx+edx*8]
0059C03D  mov     dword ptr [esp+90h+var_48], eax
0059C041  mov     dword ptr [esp+90h+var_50], ecx
0059C045  jmp     short loc_59C04B
0059C047  mov     edi, [esp+90h+var_6C]
0059C04B  and     eax, 7
0059C04E  lea     ecx, ds:89F688h[eax*4]
0059C055  mov     ax, word ptr dword_89F688[eax*4]
0059C05D  mov     cx, [ecx+2]
0059C061  add     ax, [edi]
0059C064  add     cx, [edi+2]
0059C068  mov     word ptr [esp+90h+var_58], ax
0059C06D  mov     word ptr [esp+90h+var_58+2], cx
0059C072  mov     edx, [esp+90h+var_58]
0059C076  mov     [esp+90h+var_78], edx
0059C07A  movsx   edx, ax
0059C07D  movsx   eax, cx
0059C080  lea     ecx, [eax+edx]
0059C083  cmp     ecx, ebx
0059C085  jle     loc_59C2A8
0059C08B  mov     edi, edx
0059C08D  sub     edi, eax
0059C08F  cmp     edi, ebx
0059C091  jge     loc_59C2A8
0059C097  mov     edi, eax
0059C099  sub     edi, edx
0059C09B  cmp     edi, ebx
0059C09D  jge     loc_59C2A8
0059C0A3  cmp     ecx, dword_ABED08
0059C0A9  jg      loc_59C2A8
0059C0AF  imul    eax, dword_89C2DC
0059C0B6  mov     ecx, dword_ABED10
0059C0BC  add     eax, edx
0059C0BE  lea     edi, [eax+eax*4]
0059C0C1  shl     edi, 4
0059C0C4  add     edi, ecx
0059C0C6  mov     eax, [edi+38h]
0059C0C9  test    eax, eax
0059C0CB  jnz     loc_59C2A8
0059C0D1  mov     ecx, [esp+90h+var_80]
0059C0D5  mov     eax, [edi+3Ch]
0059C0D8  cmp     eax, [ecx+308h]
0059C0DE  jz      loc_59C2A8
0059C0E4  lea     edx, [esp+90h+var_78]
0059C0E8  mov     ecx, offset stru_87F7E8
0059C0ED  push    edx
0059C0EE  call    sub_5657A0
0059C0F3  mov     ecx, eax
0059C0F5  call    sub_4865D0
0059C0FA  test    al, al
0059C0FC  jz      loc_59C2A2
0059C102  mov     eax, [esp+90h+var_70]
0059C106  mov     ecx, [esp+90h+var_54]
0059C10A  cmp     eax, ecx
0059C10C  jge     loc_59C2A2
0059C112  mov     ecx, dword ptr [esp+90h+var_18+4]
0059C116  mov     edx, dword ptr [esp+90h+var_18]
0059C11A  mov     eax, dword ptr [esp+90h+var_10+4]
0059C121  push    ecx
0059C122  mov     ecx, dword ptr [esp+94h+var_10]
0059C129  push    edx; double
0059C12A  mov     edx, [ebp+arg_C]
0059C12D  push    eax
0059C12E  mov     eax, [ebp+arg_4]
0059C131  push    ecx; double
0059C132  push    edx; int
0059C133  lea     ecx, [esp+0A4h+var_78]
0059C137  push    eax; int
0059C138  push    ecx; int
0059C139  mov     ecx, [esp+0ACh+var_80]
0059C13D  call    sub_59BAB0
0059C142  test    al, al
0059C144  jz      loc_59C2A2
0059C14A  fld     [esp+90h+var_28]
0059C14E  mov     ebx, dword ptr [esp+90h+var_50]
0059C152  mov     edx, [esp+90h+var_78]
0059C156  fadd    ds:dbl_7E1738
0059C15C  mov     [ebx], edx
0059C15E  call    sub_7C5F00
0059C163  fld     [esp+90h+var_20]
0059C167  fadd    ds:dbl_7E1738
0059C16D  mov     word ptr [esp+90h+var_5C], ax
0059C172  call    sub_7C5F00
0059C177  mov     word ptr [esp+90h+var_5C+2], ax
0059C17C  mov     ecx, [esp+90h+var_5C]
0059C180  mov     [esp+90h+var_40], ecx
0059C184  mov     cl, [ebp+arg_1C]
0059C187  test    cl, cl
0059C189  jz      short loc_59C1B2
0059C18B  mov     edx, [esp+90h+var_64]
0059C18F  mov     eax, [esp+90h+var_60]
0059C193  mov     ecx, [ebp+arg_10]
0059C196  push    edx; float
0059C197  mov     edx, [ebp+arg_4]
0059C19A  push    eax; float
0059C19B  push    ecx; int
0059C19C  lea     eax, [esp+9Ch+var_78]
0059C1A0  push    edx; int
0059C1A1  lea     ecx, [esp+0A0h+var_40]
0059C1A5  push    eax; int
0059C1A6  push    ecx; int
0059C1A7  mov     ecx, [esp+0A8h+var_80]
0059C1AB  call    sub_59B940
0059C1B0  jmp     short loc_59C221
0059C1B2  movsx   edx, word ptr [esp+90h+var_5C]
0059C1B7  movsx   ecx, word ptr [esp+90h+var_78]
0059C1BC  sub     ecx, edx
0059C1BE  sub     esp, 8
0059C1C1  movsx   edx, ax
0059C1C4  movsx   eax, word ptr [esp+98h+var_78+2]
0059C1C9  sub     eax, edx
0059C1CB  mov     edx, ecx
0059C1CD  imul    edx, ecx
0059C1D0  mov     ecx, eax
0059C1D2  imul    ecx, eax
0059C1D5  add     edx, ecx
0059C1D7  mov     dword ptr [esp+98h+var_50], edx
0059C1DB  fild    dword ptr [esp+98h+var_50]
0059C1DF  fstp    [esp+98h+var_98]; double
0059C1E2  call    sub_4CAC40
0059C1E7  fstp    [esp+98h+var_30]
0059C1EB  add     esp, 8
0059C1EE  mov     ecx, offset unk_ABE890
0059C1F3  call    sub_65C780
0059C1F8  mov     dword ptr [esp+90h+var_8], eax
0059C1FF  mov     dword ptr [esp+90h+var_8+4], 0
0059C20A  fild    [esp+90h+var_8]
0059C211  fmul    ds:dbl_7ED808
0059C217  fmul    ds:dbl_7ED898
0059C21D  fadd    [esp+90h+var_30]
0059C221  mov     edx, [esp+90h+var_80]
0059C225  mov     ecx, [esp+90h+var_70]
0059C229  fstp    dword ptr [ebx+4]
0059C22C  mov     eax, [edx+308h]
0059C232  inc     ecx
0059C233  mov     [edi+3Ch], eax
0059C236  mov     eax, ebx
0059C238  mov     [esp+90h+var_70], ecx
0059C23C  mov     ecx, [esi]
0059C23E  mov     edi, [eax+4]
0059C241  add     ebx, 8
0059C244  inc     ecx
0059C245  mov     [esp+58h], edi
0059C249  mov     edi, [esi+4]
0059C24C  mov     edx, ecx
0059C24E  shr     edx, 1
0059C250  cmp     ecx, edi
0059C252  mov     dword ptr [esp+90h+var_30], eax
0059C256  mov     dword ptr [esp+90h+var_50], ebx
0059C25A  jnb     short loc_59C2A2
0059C25C  cmp     ecx, 1
0059C25F  jbe     short loc_59C285
0059C261  mov     edi, [esi+8]
0059C264  mov     ebx, [edi+edx*4]
0059C267  fld     dword ptr [ebx+4]
0059C26A  fcomp   dword ptr [esp+58h]
0059C26E  fnstsw  ax
0059C270  test    ah, 41h
0059C273  jnz     short loc_59C281
0059C275  mov     [edi+ecx*4], ebx
0059C278  mov     ecx, edx
0059C27A  shr     edx, 1
0059C27C  cmp     ecx, 1
0059C27F  ja      short loc_59C261
0059C281  mov     eax, dword ptr [esp+90h+var_30]
0059C285  mov     edx, [esi+8]
0059C288  mov     [edx+ecx*4], eax
0059C28B  mov     edx, [esi]
0059C28D  mov     ecx, [esi+0Ch]
0059C290  inc     edx
0059C291  cmp     eax, ecx
0059C293  mov     [esi], edx
0059C295  jbe     short loc_59C29A
0059C297  mov     [esi+0Ch], eax
0059C29A  cmp     eax, [esi+10h]
0059C29D  jnb     short loc_59C2A2
0059C29F  mov     [esi+10h], eax
0059C2A2  mov     ebx, dword_ABED04
0059C2A8  mov     eax, dword ptr [esp+90h+var_48]
0059C2AC  add     eax, 2
0059C2AF  cmp     eax, 8
0059C2B2  mov     dword ptr [esp+90h+var_48], eax
0059C2B6  jl      loc_59C047
0059C2BC  mov     ecx, offset byte_ABDFB8
0059C2C1  call    sub_5980C0
0059C2C6  fmul    [ebp+arg_14]
0059C2C9  mov     ecx, offset byte_ABDFB8
0059C2CE  fadd    [esp+90h+var_28]
0059C2D2  fstp    [esp+90h+var_28]
0059C2D6  call    sub_5980C0
0059C2DB  fmul    [ebp+arg_14]
0059C2DE  mov     ecx, [esp+90h+var_74]
0059C2E2  inc     ecx
0059C2E3  fadd    [esp+90h+var_20]
0059C2E7  mov     [esp+90h+var_74], ecx
0059C2EB  mov     ecx, [esi]
0059C2ED  test    ecx, ecx
0059C2EF  fstp    [esp+90h+var_20]
0059C2F3  jnz     short loc_59C2F9
0059C2F5  xor     edi, edi
0059C2F7  jmp     short loc_59C31F
0059C2F9  mov     eax, [esi+8]
0059C2FC  push    1
0059C2FE  mov     ecx, [eax+ecx*4]
0059C301  mov     edi, [eax+4]
0059C304  mov     [eax+4], ecx
0059C307  mov     edx, [esi]
0059C309  mov     eax, [esi+8]
0059C30C  mov     dword ptr [eax+edx*4], 0
0059C313  mov     ecx, [esi]
0059C315  dec     ecx
0059C316  mov     [esi], ecx
0059C318  mov     ecx, esi
0059C31A  call    sub_5AD870
0059C31F  mov     ecx, [esp+90h+var_74]
0059C323  mov     eax, [ebp+arg_0]
0059C326  cmp     ecx, eax
0059C328  mov     [esp+90h+var_6C], edi
0059C32C  jl      loc_59BFE2
0059C332  mov     ecx, [esi]
0059C334  test    ecx, ecx
0059C336  jz      loc_59C3FC
0059C33C  mov     eax, [esi+8]
0059C33F  push    1
0059C341  mov     edx, [eax+ecx*4]
0059C344  mov     edi, [eax+4]
0059C347  mov     [eax+4], edx
0059C34A  mov     eax, [esi]
0059C34C  mov     ecx, [esi+8]
0059C34F  mov     dword ptr [ecx+eax*4], 0
0059C356  mov     edx, [esi]
0059C358  dec     edx
0059C359  mov     ecx, esi
0059C35B  mov     [esi], edx
0059C35D  call    sub_5AD870
0059C362  test    edi, edi
0059C364  jz      loc_59C3FC
0059C36A  push    edi
0059C36B  mov     ecx, offset stru_87F7E8
0059C370  call    sub_5657A0
0059C375  mov     ebx, eax
0059C377  mov     ecx, dword_ABED10
0059C37D  movsx   eax, word ptr [edi+2]
0059C381  imul    eax, dword_89C2DC
0059C388  movsx   edx, word ptr [edi]
0059C38B  add     eax, edx
0059C38D  lea     edi, [eax+eax*4]
0059C390  shl     edi, 4
0059C393  add     edi, ecx
0059C395  mov     eax, [edi+38h]
0059C398  test    eax, eax
0059C39A  jnz     short loc_59C3BB
0059C39C  mov     ecx, ebx
0059C39E  call    sub_4865D0
0059C3A3  test    al, al
0059C3A5  jz      short loc_59C3BB
0059C3A7  mov     eax, [esp+90h+var_80]
0059C3AB  mov     dword ptr [ebx+38h], 0
0059C3B2  mov     ecx, [eax+308h]
0059C3B8  mov     [edi+38h], ecx
0059C3BB  mov     ecx, [esi]
0059C3BD  test    ecx, ecx
0059C3BF  jnz     short loc_59C3C5
0059C3C1  xor     edi, edi
0059C3C3  jmp     short loc_59C3EB
0059C3C5  mov     eax, [esi+8]
0059C3C8  push    1
0059C3CA  mov     edx, [eax+ecx*4]
0059C3CD  mov     edi, [eax+4]
0059C3D0  mov     [eax+4], edx
0059C3D3  mov     eax, [esi]
0059C3D5  mov     ecx, [esi+8]
0059C3D8  mov     dword ptr [ecx+eax*4], 0
0059C3DF  mov     ecx, [esi]
0059C3E1  dec     ecx
0059C3E2  mov     [esi], ecx
0059C3E4  mov     ecx, esi
0059C3E6  call    sub_5AD870
0059C3EB  mov     ecx, [esp+90h+var_74]
0059C3EF  inc     ecx
0059C3F0  test    edi, edi
0059C3F2  mov     [esp+90h+var_74], ecx
0059C3F6  jnz     loc_59C36A
0059C3FC  mov     edx, [esp+90h+Block]
0059C400  mov     ebx, [esp+90h+var_80]
0059C404  push    edx; Block
0059C405  call    ??3@YAXPAX@Z; operator delete(void *)
0059C40A  xor     edi, edi
0059C40C  add     esp, 4
0059C40F  cmp     esi, edi
0059C411  jz      short loc_59C425
0059C413  mov     eax, [esi+8]
0059C416  push    eax; Block
0059C417  call    ??3@YAXPAX@Z; operator delete(void *)
0059C41C  push    esi; Block
0059C41D  call    ??3@YAXPAX@Z; operator delete(void *)
0059C422  add     esp, 8
0059C425  mov     ecx, [ebx+308h]
0059C42B  push    1
0059C42D  push    ecx
0059C42E  mov     ecx, offset stru_87F7E8
0059C433  call    sub_57A0C0
0059C438  mov     ecx, offset stru_87F7E8
0059C43D  mov     [esp+90h+var_81], al
0059C441  call    sub_578350
0059C446  mov     ecx, offset stru_87F7E8
0059C44B  call    sub_578290
0059C450  cmp     eax, edi
0059C452  jz      short loc_59C480
0059C454  mov     ecx, [eax+38h]
0059C457  mov     edx, dword_ABAD28
0059C45D  cmp     ecx, edx
0059C45F  jl      short loc_59C472
0059C461  add     edx, 2Ah ; '*'
0059C464  cmp     ecx, edx
0059C466  jge     short loc_59C472
0059C468  mov     [eax+38h], edi
0059C46B  mov     byte ptr [eax+11Ah], 0
0059C472  mov     ecx, offset stru_87F7E8
0059C477  call    sub_578290
0059C47C  cmp     eax, edi
0059C47E  jnz     short loc_59C454
0059C480  mov     al, [esp+90h+var_81]
0059C484  test    al, al
0059C486  jnz     loc_59C515
0059C48C  mov     esi, dword_AA0738
0059C492  mov     edi, [ebx+308h]
0059C498  mov     ecx, offset stru_87F7E8
0059C49D  call    sub_578350
0059C4A2  mov     ecx, offset stru_87F7E8
0059C4A7  call    sub_578290
0059C4AC  test    eax, eax
0059C4AE  jz      short loc_59C50A
0059C4B0  mov     edx, [eax+24h]
0059C4B3  mov     dword ptr [esp+90h+var_30], edx
0059C4B7  movsx   ecx, word ptr [esp+90h+var_30+2]
0059C4BC  imul    ecx, dword_89C2DC
0059C4C3  movsx   edx, dx
0059C4C6  add     ecx, edx
0059C4C8  mov     edx, dword_ABED10
0059C4CE  lea     ecx, [ecx+ecx*4]
0059C4D1  shl     ecx, 4
0059C4D4  add     ecx, edx
0059C4D6  cmp     [ecx+38h], edi
0059C4D9  jnz     short loc_59C4FC
0059C4DB  mov     dword ptr [ecx+38h], 0
0059C4E2  mov     byte ptr [ecx+4Bh], 0
0059C4E6  mov     [eax+38h], esi
0059C4E9  mov     byte ptr [eax+11Ah], 0
0059C4F0  mov     ecx, [ebx+30Ch]
0059C4F6  mov     [eax+11Bh], cl
0059C4FC  mov     ecx, offset stru_87F7E8
0059C501  call    sub_578290
0059C506  test    eax, eax
0059C508  jnz     short loc_59C4B0
0059C50A  xor     eax, eax
0059C50C  pop     edi
0059C50D  pop     esi
0059C50E  pop     ebx
0059C50F  mov     esp, ebp
0059C511  pop     ebp
0059C512  retn    20h ; ' '
0059C515  mov     ecx, [ebx+308h]
0059C51B  mov     eax, [esp+90h+var_74]
0059C51F  inc     ecx
0059C520  pop     edi
0059C521  mov     [ebx+308h], ecx
0059C527  pop     esi
0059C528  pop     ebx
0059C529  mov     esp, ebp
0059C52B  pop     ebp
0059C52C  retn    20h ; ' '