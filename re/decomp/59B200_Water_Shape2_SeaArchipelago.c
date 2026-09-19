// 0x59b200 Water_Shape2_SeaArchipelago size=4CF

int __thiscall sub_59B200(int *this)
{
  int i; // eax
  int v3; // esi
  double v4; // st7
  int v5; // eax
  int v6; // edi
  int v7; // ebp
  int v8; // ebx
  __int16 *v9; // esi
  int v10; // ecx
  int v11; // eax
  int v12; // edx
  int v13; // eax
  __int64 v14; // rax
  int v15; // eax
  bool v16; // zf
  int result; // eax
  int v18; // [esp+10h] [ebp-B8h]
  int v19; // [esp+10h] [ebp-B8h]
  int v20; // [esp+14h] [ebp-B4h]
  double v21; // [esp+18h] [ebp-B0h]
  int v22; // [esp+20h] [ebp-A8h]
  int v23; // [esp+24h] [ebp-A4h]
  int v24; // [esp+28h] [ebp-A0h]
  int *v25; // [esp+2Ch] [ebp-9Ch]
  int v26; // [esp+30h] [ebp-98h] BYREF
  int v27; // [esp+34h] [ebp-94h]
  int v28; // [esp+38h] [ebp-90h]
  int v29; // [esp+3Ch] [ebp-8Ch]
  double v30; // [esp+40h] [ebp-88h]
  int v31; // [esp+4Ch] [ebp-7Ch] BYREF
  int v32; // [esp+50h] [ebp-78h]
  int v33; // [esp+54h] [ebp-74h]
  int v34; // [esp+58h] [ebp-70h]
  _DWORD *v35; // [esp+5Ch] [ebp-6Ch]
  int v36; // [esp+60h] [ebp-68h] BYREF
  int v37; // [esp+64h] [ebp-64h]
  double v38; // [esp+68h] [ebp-60h]
  double v39; // [esp+70h] [ebp-58h]
  _DWORD v40[2]; // [esp+78h] [ebp-50h] BYREF
  int v41; // [esp+80h] [ebp-48h]
  int v42; // [esp+84h] [ebp-44h]
  int v43; // [esp+88h] [ebp-40h]
  int v44; // [esp+8Ch] [ebp-3Ch]
  int v45; // [esp+90h] [ebp-38h]
  int v46; // [esp+94h] [ebp-34h]
  int v47; // [esp+98h] [ebp-30h]
  int v48; // [esp+9Ch] [ebp-2Ch]
  double v49; // [esp+A0h] [ebp-28h]
  double v50; // [esp+A8h] [ebp-20h]
  int v51; // [esp+B4h] [ebp-14h]
  double v52; // [esp+B8h] [ebp-10h]
  double v53; // [esp+C0h] [ebp-8h]

  v35 = this;
  *(this + 194) = 1;
  v18 = sub_42B1F0();
  v23 = 0;
  v38 = (1.0 - (double)*(this + 19) * 0.01) * (0.2 - 0.15) + 0.15;
  v50 = (double)v18;
  v48 = sub_7C5F00(v50 * 0.06 * v38);
  sub_578350(&stru_87F7E8);
  for ( i = sub_578290(&stru_87F7E8); i != 0; i = sub_578290(&stru_87F7E8) )
    *((_DWORD *)dword_ABED10
    + 20 * (__int16)*(_DWORD *)(i + 36)
    + 20 * dword_89C2DC * (__int16)HIWORD(*(_DWORD *)(i + 36))
    + 15) = 0;
  *(_QWORD *)&v30 = (unsigned int)sub_65C780(&unk_ABE890);
  v40[0] = dword_87F8E4;
  v40[1] = dword_87F8E8;
  if ( (double)*(__int64 *)&v30 * 2.328306437080797e-10 >= 0.5 )
  {
    v41 = dword_87F8EC;
    v42 = dword_87F8F0 / 2 - 1;
    v43 = dword_87F8E4;
    v44 = dword_87F8F0 / 2 + dword_87F8E8 + 1;
    v45 = dword_87F8EC;
    v46 = v42;
  }
  else
  {
    v42 = dword_87F8F0;
    v41 = dword_87F8EC / 2 - 1;
    v43 = dword_87F8EC / 2 + dword_87F8E4 + 1;
    v44 = dword_87F8E8;
    v45 = v41;
    v46 = dword_87F8F0;
  }
  v19 = 2;
  v25 = v40;
  do
  {
    v22 = 0;
    v39 = 0.0;
    v26 = *v25;
    v27 = v25[1];
    v28 = v25[2];
    v29 = v25[3];
    v3 = v27 + dword_87F8DC + v29 / 2 - v28 / 2 - v26;
    v32 = v26 + v29 / 2 + v28 / 2 + v27 + 1;
    v33 = v3;
    v36 = v32;
    v37 = v3;
    if ( v29 <= v28 )
    {
      v4 = (double)v28;
      v30 = 1.0;
      v21 = (double)v29;
      v49 = v4 / v21 * 1.2;
    }
    else
    {
      v49 = 1.0;
      v21 = (double)v29;
      v4 = (double)v28;
      v30 = v21 / v4 * 1.2;
    }
    v53 = 1.0 / (v4 * 0.5 * (v4 * 0.5));
    v52 = 1.0 / (v21 * 0.5 * (v21 * 0.5));
    if ( v38 > 0.0 )
    {
      do
      {
        if ( v23 >= 100 )
          break;
        v5 = sub_7C5F00((v38 - v39) * v50);
        if ( v5 >= v48 )
          v5 = v48;
        LOWORD(v31) = v32;
        HIWORD(v31) = v3;
        v22 += sub_59BBC0(v35, v5, &v26, (int)&v36, 1, (int)&v31, 0.75, 1);
        v20 = 0;
        ++v23;
        v6 = 2 * v26 - dword_87F8DC + 1;
        v7 = 50000;
        v47 = v6 + 2 * v28 + 2;
        v8 = dword_87F8DC + 2 * v27 + 1;
        v51 = v8 + 2 * v29 + 2;
        v39 = (double)v22 / v50;
        if ( dword_89C2DC * dword_89C2DC > 0 )
        {
          v24 = 0;
          v34 = dword_89C2DC * dword_89C2DC;
          do
          {
            v9 = (__int16 *)((char *)dword_ABED10 + v24);
            v10 = *(__int16 *)((char *)dword_ABED10 + v24 + 2);
            v11 = *(__int16 *)((char *)dword_ABED10 + v24);
            v12 = v11 + v10;
            v13 = v11 - v10;
            if ( v12 >= v8
              && v12 <= v51
              && v13 >= v6
              && v13 <= v47
              && *((_DWORD *)v9 + 15) == 0
              && (unsigned __int8)sub_59BAB0((int)dword_ABED10 + v24, (int)&v26, 1, v53, v52) != 0 )
            {
              v14 = v9[1] - v33;
              v15 = sub_7C5F00((double)(int)((HIDWORD(v14) ^ v14) - HIDWORD(v14)) * v49 + (double)(int)abs32(*v9 - v32)
                                                                                        * v30);
              if ( v15 < v7 )
              {
                v7 = v15;
                v20 = *(_DWORD *)v9;
              }
            }
            v16 = v34 == 1;
            v24 += 80;
            --v34;
          }
          while ( !v16 );
          LOWORD(v3) = v33;
        }
        v36 = (__int16)v20;
        v37 = SHIWORD(v20);
      }
      while ( v39 < v38 );
    }
    result = v19 - 1;
    v16 = v19 == 1;
    v25 += 4;
    --v19;
  }
  while ( !v16 );
  return result;
}
