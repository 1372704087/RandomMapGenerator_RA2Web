// 0x58f2c0 watch_58F2C0 size=FFF

char __thiscall sub_58F2C0(_DWORD *this, int a2, int a3)
{
  int v4; // eax
  int v5; // ecx
  char result; // al
  int v7; // edi
  unsigned int v8; // eax
  unsigned int v9; // esi
  int v10; // eax
  int v11; // esi
  int v12; // ebp
  int v13; // esi
  int v14; // ebp
  int v15; // esi
  int v16; // ebp
  int v17; // esi
  int v18; // ebp
  int v19; // ebx
  int v20; // ebp
  int v21; // edi
  int v22; // ecx
  int v23; // eax
  char v24; // bl
  int v25; // eax
  int v26; // ecx
  int v27; // edx
  int v28; // eax
  int v29; // ebp
  int v30; // edx
  int v31; // ebx
  int v32; // ecx
  int v33; // eax
  int v34; // esi
  __int16 v35; // di
  char v36; // bl
  int v37; // edx
  unsigned int v38; // eax
  int v39; // edx
  unsigned int v40; // eax
  int v41; // edx
  int v42; // ecx
  int v43; // ebp
  int v44; // eax
  int v45; // ebx
  __int16 v46; // si
  __int16 v47; // di
  unsigned int v48; // eax
  int v49; // edx
  unsigned int v50; // eax
  char v51; // [esp+11h] [ebp-207h]
  char v52; // [esp+12h] [ebp-206h]
  char v53; // [esp+13h] [ebp-205h]
  char v54; // [esp+13h] [ebp-205h]
  int v55; // [esp+14h] [ebp-204h] BYREF
  int v56; // [esp+18h] [ebp-200h]
  int v57; // [esp+1Ch] [ebp-1FCh]
  int v58; // [esp+20h] [ebp-1F8h]
  _DWORD *v59; // [esp+24h] [ebp-1F4h]
  double v60; // [esp+28h] [ebp-1F0h]
  _WORD v61[2]; // [esp+30h] [ebp-1E8h] BYREF
  int v62; // [esp+34h] [ebp-1E4h]
  _WORD v63[2]; // [esp+38h] [ebp-1E0h] BYREF
  _WORD v64[2]; // [esp+3Ch] [ebp-1DCh] BYREF
  _WORD v65[2]; // [esp+40h] [ebp-1D8h] BYREF
  int v66; // [esp+44h] [ebp-1D4h]
  _WORD v67[2]; // [esp+48h] [ebp-1D0h] BYREF
  _WORD v68[2]; // [esp+4Ch] [ebp-1CCh] BYREF
  int v69; // [esp+50h] [ebp-1C8h]
  _WORD v70[2]; // [esp+54h] [ebp-1C4h] BYREF
  int v71; // [esp+58h] [ebp-1C0h]
  _WORD v72[2]; // [esp+5Ch] [ebp-1BCh] BYREF
  int v73; // [esp+60h] [ebp-1B8h]
  int v74; // [esp+64h] [ebp-1B4h]
  int v75; // [esp+68h] [ebp-1B0h]
  int v76; // [esp+6Ch] [ebp-1ACh]
  int v77; // [esp+70h] [ebp-1A8h]
  int v78; // [esp+74h] [ebp-1A4h]
  int v79; // [esp+78h] [ebp-1A0h]
  int v80; // [esp+7Ch] [ebp-19Ch]
  int v81; // [esp+80h] [ebp-198h]
  int v82; // [esp+84h] [ebp-194h]
  int v83; // [esp+88h] [ebp-190h]
  int v84; // [esp+8Ch] [ebp-18Ch]
  int v85; // [esp+90h] [ebp-188h]
  int v86; // [esp+94h] [ebp-184h]
  int v87; // [esp+98h] [ebp-180h]
  int v88; // [esp+9Ch] [ebp-17Ch]
  __int16 v89; // [esp+A0h] [ebp-178h]
  __int16 v90; // [esp+A2h] [ebp-176h]
  _WORD v91[4]; // [esp+A4h] [ebp-174h] BYREF
  _WORD v92[4]; // [esp+ACh] [ebp-16Ch] BYREF
  _WORD v93[2]; // [esp+B4h] [ebp-164h] BYREF
  _WORD v94[4]; // [esp+B8h] [ebp-160h] BYREF
  _WORD v95[4]; // [esp+C0h] [ebp-158h] BYREF
  _WORD v96[6]; // [esp+C8h] [ebp-150h] BYREF
  int v97; // [esp+D4h] [ebp-144h]
  _WORD v98[4]; // [esp+D8h] [ebp-140h] BYREF
  _WORD v99[2]; // [esp+E0h] [ebp-138h] BYREF
  __int64 v100; // [esp+E4h] [ebp-134h]
  __int64 v101; // [esp+ECh] [ebp-12Ch]
  __int64 v102; // [esp+F4h] [ebp-124h]
  __int64 v103; // [esp+FCh] [ebp-11Ch]
  __int64 v104; // [esp+104h] [ebp-114h]
  __int64 v105; // [esp+10Ch] [ebp-10Ch]
  int v106; // [esp+114h] [ebp-104h]
  int v107; // [esp+118h] [ebp-100h]
  int v108; // [esp+11Ch] [ebp-FCh]
  int v109; // [esp+120h] [ebp-F8h]
  _DWORD v110[4]; // [esp+124h] [ebp-F4h] BYREF
  _DWORD v111[8]; // [esp+134h] [ebp-E4h] BYREF
  _DWORD v112[8]; // [esp+154h] [ebp-C4h] BYREF
  _DWORD v113[4]; // [esp+174h] [ebp-A4h] BYREF
  _DWORD v114[4]; // [esp+184h] [ebp-94h] BYREF
  _DWORD v115[8]; // [esp+194h] [ebp-84h] BYREF
  _DWORD v116[4]; // [esp+1B4h] [ebp-64h] BYREF
  _DWORD v117[4]; // [esp+1C4h] [ebp-54h] BYREF
  _DWORD v118[4]; // [esp+1D4h] [ebp-44h] BYREF
  _DWORD v119[4]; // [esp+1E4h] [ebp-34h] BYREF
  _DWORD v120[4]; // [esp+1F4h] [ebp-24h] BYREF
  _DWORD v121[4]; // [esp+204h] [ebp-14h] BYREF

  v4 = *(_DWORD *)(a3 + 8);
  v97 = *(_DWORD *)(a2 + 8);
  v5 = dword_89C2DC;
  v59 = this;
  v71 = v4;
  v66 = 0;
  v53 = 0;
  while ( 1 )
  {
    result = v53;
    if ( v53 != 0 )
      return result;
    v7 = v5 * v5;
    while ( 1 )
    {
      v101 = (unsigned int)v7;
      v60 = (double)(unsigned int)v7;
      do
      {
        v102 = (unsigned int)sub_65C780(&unk_ABE890);
        v8 = sub_7C5F00((double)v102 * v60 * 2.328306437080797e-10);
        v9 = v8;
      }
      while ( v8 > v7 - 1 );
      if ( *((_DWORD *)dword_ABED10 + 20 * v8 + 14) == *(this + 2) )
      {
        v10 = sub_42D470(0, 0);
        if ( (unsigned __int8)sub_50E470(v10) == 0 )
          break;
      }
    }
    LODWORD(v60) = *((_DWORD *)dword_ABED10 + 20 * v9);
    v78 = SWORD1(v60);
    v82 = SWORD1(v60);
    v77 = SLOWORD(v60) - 1;
    v81 = v77;
    v86 = SWORD1(v60) - 1;
    v87 = 1;
    v74 = v86;
    v75 = 1;
    v79 = 3;
    v80 = 1;
    v83 = 3;
    v84 = 1;
    v85 = SLOWORD(v60);
    v88 = 3;
    v73 = SLOWORD(v60);
    v76 = 3;
    v52 = 1;
    v51 = 1;
    if ( (unsigned __int8)sub_5A7250(0) != 0 )
    {
LABEL_15:
      v106 = v77;
      v107 = v78 - 3;
      v108 = 3;
      v109 = 3;
      if ( (unsigned __int8)sub_5A7250(0) != 0 )
      {
        if ( (unsigned __int8)sub_5A7250(0) != 0 )
        {
LABEL_22:
          v111[4] = v81;
          v111[5] = v82 + 1;
          v111[6] = 3;
          v111[7] = 3;
          if ( (unsigned __int8)sub_5A7250(0) != 0 )
            goto LABEL_24;
        }
        else
        {
          while ( 1 )
          {
            v70[0] = v81;
            v63[0] = v81 + 2;
            v70[1] = ++v82;
            v63[1] = v82;
            v13 = sub_5657A0(v70);
            v14 = sub_5657A0(v63);
            if ( (unsigned __int8)sub_578460(v70, 1) == 0
              || (unsigned __int8)sub_578460(v63, 1) == 0
              || (unsigned __int8)sub_4863D0(v13) != 0
              || (unsigned __int8)sub_4863D0(v14) != 0 )
            {
              break;
            }
            if ( (unsigned __int8)sub_5A7250(0) != 0 )
              goto LABEL_22;
          }
        }
      }
    }
    else
    {
      while ( 1 )
      {
        v64[0] = v77;
        v68[0] = v77 + 2;
        v64[1] = --v78;
        v68[1] = v78;
        v11 = sub_5657A0(v64);
        v12 = sub_5657A0(v68);
        if ( (unsigned __int8)sub_578460(v64, 1) == 0
          || (unsigned __int8)sub_578460(v68, 1) == 0
          || (unsigned __int8)sub_4863D0(v11) != 0
          || (unsigned __int8)sub_4863D0(v12) != 0 )
        {
          break;
        }
        if ( (unsigned __int8)sub_5A7250(0) != 0 )
          goto LABEL_15;
      }
    }
    v51 = 0;
LABEL_24:
    if ( (unsigned __int8)sub_5A7250(0) != 0 )
    {
LABEL_30:
      v115[4] = v73 - 3;
      v115[5] = v74;
      v115[6] = 3;
      v115[7] = 3;
      if ( (unsigned __int8)sub_5A7250(0) != 0 )
      {
        if ( (unsigned __int8)sub_5A7250(0) != 0 )
        {
LABEL_37:
          v112[4] = v85 + 1;
          v112[5] = v86;
          v112[6] = 3;
          v112[7] = 3;
          if ( (unsigned __int8)sub_5A7250(0) != 0 )
            goto LABEL_39;
        }
        else
        {
          while ( 1 )
          {
            v61[1] = v86;
            v67[1] = v86 + 2;
            v61[0] = ++v85;
            v67[0] = v85;
            v17 = sub_5657A0(v61);
            v18 = sub_5657A0(v67);
            if ( (unsigned __int8)sub_578460(v61, 1) == 0
              || (unsigned __int8)sub_578460(v67, 1) == 0
              || (unsigned __int8)sub_4863D0(v17) != 0
              || (unsigned __int8)sub_4863D0(v18) != 0 )
            {
              break;
            }
            if ( (unsigned __int8)sub_5A7250(0) != 0 )
              goto LABEL_37;
          }
        }
      }
    }
    else
    {
      while ( 1 )
      {
        v72[1] = v74;
        v65[1] = v74 + 2;
        v72[0] = --v73;
        v65[0] = v73;
        v15 = sub_5657A0(v72);
        v16 = sub_5657A0(v65);
        if ( (unsigned __int8)sub_578460(v72, 1) == 0
          || (unsigned __int8)sub_578460(v65, 1) == 0
          || (unsigned __int8)sub_4863D0(v15) != 0
          || (unsigned __int8)sub_4863D0(v16) != 0 )
        {
          break;
        }
        if ( (unsigned __int8)sub_5A7250(0) != 0 )
          goto LABEL_30;
      }
    }
    v52 = 0;
LABEL_39:
    v19 = -1;
    LODWORD(v60) = 999;
    v62 = 999;
    v20 = -1;
    v69 = -1;
    v21 = -1;
    if ( v51 != 0 )
    {
      LODWORD(v60) = abs32(v82 - v78);
      if ( dword_ABED10 != nullptr )
      {
        v19 = *((_DWORD *)dword_ABED10 + 20 * (__int16)v77 + 20 * dword_89C2DC * (__int16)v78 + 14);
        v20 = *((_DWORD *)dword_ABED10 + 20 * (__int16)v81 + 20 * dword_89C2DC * (__int16)v82 + 14);
      }
      else
      {
        v20 = -1;
      }
    }
    if ( v52 != 0 )
    {
      v62 = abs32(v85 - v73);
      if ( dword_ABED10 != nullptr )
      {
        v69 = *((_DWORD *)dword_ABED10 + 20 * (__int16)v85 + 20 * dword_89C2DC * (__int16)v86 + 14);
        v21 = *((_DWORD *)dword_ABED10 + 20 * (__int16)v73 + 20 * dword_89C2DC * (__int16)v74 + 14);
      }
      else
      {
        v69 = -1;
        v21 = -1;
      }
    }
    if ( v51 != 0 )
    {
      v22 = v97;
      v23 = v71;
      if ( (v19 != v97 || v20 != v71) && (v19 != v71 || v20 != v97) )
        v51 = 0;
    }
    else
    {
      v23 = v71;
      v22 = v97;
    }
    v24 = v52;
    if ( v52 != 0 )
    {
      if ( v69 == v22 && v21 == v23 || v69 == v23 && v21 == v22 )
      {
        if ( v51 != 0 )
        {
          if ( SLODWORD(v60) >= v62 )
          {
            v51 = 0;
          }
          else
          {
            v24 = 0;
            v52 = 0;
          }
        }
      }
      else
      {
        v24 = 0;
        v52 = 0;
      }
    }
    v55 = 0;
    v56 = 0;
    v57 = 0;
    v58 = 0;
    v25 = v66 / 25 + 8;
    if ( v24 != 0 && v62 < v25 )
    {
      v26 = 3;
      v55 = v73;
      v27 = v74;
      v28 = v85 - v73 + 1;
    }
    else
    {
      if ( v51 == 0 || SLODWORD(v60) >= v25 )
        goto LABEL_129;
      v27 = v78;
      v28 = 3;
      v26 = v82 - v78 + 1;
      v55 = v77;
    }
    v56 = v27;
    v57 = v28;
    v58 = v26;
    if ( v28 > 0 && v26 > 0 )
    {
      if ( v52 != 0 )
      {
        if ( (unsigned __int8)sub_5902C0(&v55) == 0 )
          goto LABEL_129;
        v29 = v56;
        v30 = v57;
        v31 = v56;
        v32 = v55;
        for ( LODWORD(v60) = v56; v31 < v29 + v58; LODWORD(v60) = v31 )
        {
          v33 = v30 + v32;
          v34 = v32;
          if ( v32 < v30 + v32 )
          {
            while ( 1 )
            {
              if ( v34 == v32 )
              {
                v35 = v31;
                v96[0] = v34;
                v96[1] = v31;
                *(_DWORD *)(sub_5657A0(v96) + 68) = 94;
              }
              else
              {
                v35 = v31;
                if ( v34 == v33 - 1 )
                {
                  v91[0] = v34;
                  v91[1] = v31;
                  *(_DWORD *)(sub_5657A0(v91) + 68) = 92;
                }
                else
                {
                  v92[0] = v34;
                  v92[1] = v31;
                  *(_DWORD *)(sub_5657A0(v92) + 68) = v34 % 4 + 74;
                }
              }
              v93[0] = v34;
              v93[1] = v35;
              v36 = v31 - v56;
              *(_BYTE *)(sub_5657A0(v93) + 286) = v36;
              v30 = v57;
              v32 = v55;
              ++v34;
              v33 = v57 + v55;
              if ( v34 >= v57 + v55 )
                break;
              LOWORD(v31) = LOWORD(v60);
            }
            v29 = v56;
            v31 = LODWORD(v60);
          }
          ++v31;
        }
        v37 = v32 + v30;
        v120[0] = v37;
        LOBYTE(v37) = 0;
        v120[1] = v29 - 2;
        v120[2] = 6;
        v120[3] = 6;
        if ( (unsigned __int8)sub_5A7440(v120, v37) == 0 )
          goto LABEL_91;
        do
        {
          v104 = (unsigned int)sub_65C780(&unk_ABE890);
          v38 = sub_7C5F00((double)v104 * 4.656612874161595e-10);
        }
        while ( v38 > 1 );
        if ( v38 != 0 )
        {
          v94[2] = v55 + v57;
          v94[3] = v56;
          sub_5A6C10(-1, -1);
        }
        else
        {
LABEL_91:
          v91[3] = v56;
          v91[2] = v55 + v57;
          sub_5A6C10(-1, -1);
        }
        v39 = v55 - 6;
        v114[0] = v55 - 6;
        LOBYTE(v39) = 0;
        v114[1] = v56 - 2;
        v114[2] = 6;
        v114[3] = 6;
        if ( (unsigned __int8)sub_5A7440(v114, v39) == 0 )
          goto LABEL_96;
        do
        {
          v100 = (unsigned int)sub_65C780(&unk_ABE890);
          v40 = sub_7C5F00((double)v100 * 4.656612874161595e-10);
        }
        while ( v40 > 1 );
        if ( v40 != 0 )
        {
          v96[4] = v55 - 4;
          v96[5] = v56;
          sub_5A6C10(-1, -1);
        }
        else
        {
LABEL_96:
          v92[2] = v55 - 1;
          v92[3] = v56;
          sub_5A6C10(-1, -1);
        }
        v118[0] = v55;
        v118[1] = v56 - 1;
        v118[2] = 2;
        v118[3] = 5;
        if ( (unsigned __int8)sub_5904B0(v118) == 0 )
        {
          v110[0] = v55 - 1;
          v110[1] = v56 - 2;
          v110[2] = 3;
          v110[3] = 7;
          sub_5904B0(v110);
        }
        v111[2] = 2;
        v111[3] = 5;
        v111[1] = v56 - 1;
        v111[0] = v57 + v55 - 2;
        if ( (unsigned __int8)sub_5904B0(v111) == 0 )
        {
          v112[2] = 3;
          v112[3] = 7;
          v112[0] = v57 + v55 - 2;
          v112[1] = v56 - 2;
          sub_5904B0(v112);
        }
        goto LABEL_128;
      }
      if ( v51 != 0 && (unsigned __int8)sub_5902C0(&v55) != 0 )
      {
        v42 = v56;
        v43 = v56;
        LODWORD(v60) = v56;
        if ( v56 >= v56 + v58 )
        {
          v44 = v55;
        }
        else
        {
          v41 = v57;
          v44 = v55;
          do
          {
            v45 = v44;
            if ( v44 < v41 + v44 )
            {
              do
              {
                if ( v43 == v42 )
                {
                  v46 = v45;
                  v47 = v43;
                  v98[0] = v45;
                  v98[1] = v43;
                  *(_DWORD *)(sub_5657A0(v98) + 68) = 96;
                }
                else
                {
                  v46 = v45;
                  v47 = v43;
                  if ( v43 == v58 + v42 - 1 )
                  {
                    v94[0] = v45;
                    v94[1] = v43;
                    *(_DWORD *)(sub_5657A0(v94) + 68) = 98;
                  }
                  else
                  {
                    v99[0] = v45;
                    v99[1] = v43;
                    *(_DWORD *)(sub_5657A0(v99) + 68) = v43 % 4 + 83;
                    v43 = LODWORD(v60);
                  }
                }
                v95[0] = v46;
                v95[1] = v47;
                v54 = v45++ - v55;
                *(_BYTE *)(sub_5657A0(v95) + 286) = v54;
                v41 = v57;
                v44 = v55;
                v42 = v56;
              }
              while ( v45 < v57 + v55 );
            }
            LODWORD(v60) = ++v43;
          }
          while ( v43 < v42 + v58 );
        }
        v113[1] = v42 - 6;
        LOBYTE(v41) = 0;
        v113[0] = v44 - 2;
        v113[2] = 7;
        v113[3] = 6;
        if ( (unsigned __int8)sub_5A7440(v113, v41) == 0 )
          goto LABEL_118;
        do
        {
          v103 = (unsigned int)sub_65C780(&unk_ABE890);
          v48 = sub_7C5F00((double)v103 * 4.656612874161595e-10);
        }
        while ( v48 > 1 );
        if ( v48 != 0 )
        {
          v89 = v55;
          v90 = v56 - 4;
          sub_5A6C10(-1, -1);
        }
        else
        {
LABEL_118:
          v95[2] = v55;
          v95[3] = v56 - 1;
          sub_5A6C10(-1, -1);
        }
        v49 = v55 - 2;
        v115[0] = v55 - 2;
        v115[1] = v56 + v58;
        LOBYTE(v49) = 0;
        v115[2] = 7;
        v115[3] = 6;
        if ( (unsigned __int8)sub_5A7440(v115, v49) == 0 )
          goto LABEL_123;
        do
        {
          v105 = (unsigned int)sub_65C780(&unk_ABE890);
          v50 = sub_7C5F00((double)v105 * 4.656612874161595e-10);
        }
        while ( v50 > 1 );
        if ( v50 != 0 )
        {
          v96[3] = v58 + v56;
          v96[2] = v55;
          sub_5A6C10(-1, -1);
        }
        else
        {
LABEL_123:
          v98[2] = v55;
          v98[3] = v58 + v56;
          sub_5A6C10(-1, -1);
        }
        v117[0] = v55 - 1;
        v117[1] = v56;
        v117[2] = 5;
        v117[3] = 2;
        if ( (unsigned __int8)sub_5904B0(v117) == 0 )
        {
          v119[0] = v55 - 2;
          v119[1] = v56 - 1;
          v119[2] = 7;
          v119[3] = 3;
          sub_5904B0(v119);
        }
        v121[0] = v55 - 1;
        v121[2] = 5;
        v121[1] = v58 + v56 - 2;
        v121[3] = 2;
        if ( (unsigned __int8)sub_5904B0(v121) == 0 )
        {
          v116[0] = v55 - 2;
          v116[2] = 7;
          v116[1] = v58 + v56 - 2;
          v116[3] = 3;
          sub_5904B0(v116);
        }
LABEL_128:
        v53 = 1;
      }
    }
LABEL_129:
    if ( ++v66 >= 200 )
      return v53;
    v5 = dword_89C2DC;
    this = v59;
  }
}
